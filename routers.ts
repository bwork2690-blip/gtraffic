import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as auth from "./auth";
import * as db from "./db";
import { storagePut, storageGet } from "./storage";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    
    register: publicProcedure
      .input(
        z.object({
          username: z.string().min(3).max(64),
          password: z.string().min(6),
          name: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const user = await auth.registerUser(input.username, input.password, input.name);
          
          // Create session and set cookie
          const { user: loginUser, token } = await auth.loginUser(input.username, input.password);
          auth.setSessionCookie(ctx.res, token, ctx.req);
          
          return { success: true, user: loginUser };
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Registration failed",
          });
        }
      }),
    
    login: publicProcedure
      .input(
        z.object({
          username: z.string(),
          password: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const { user, token } = await auth.loginUser(input.username, input.password);
          auth.setSessionCookie(ctx.res, token, ctx.req);
          return { success: true, user };
        } catch (error) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid credentials",
          });
        }
      }),
    
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await auth.logoutUser(ctx.req, ctx.res);
      return { success: true };
    }),
  }),

  tasks: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role === "admin") {
        return await db.getAllTasks();
      }
      return await db.getUserTasks(ctx.user!.id);
    }),

    create: adminProcedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          assignedToUserId: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const task = await db.createTask({
          title: input.title,
          description: input.description || null,
          assignedToUserId: input.assignedToUserId,
          createdByUserId: ctx.user!.id,
          status: "pending",
          isCompleted: false,
        });
        return task;
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          status: z.enum(["pending", "in_progress", "completed", "verified"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const task = await db.getTaskById(input.id);
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        const updates: any = {};
        if (input.title) updates.title = input.title;
        if (input.description) updates.description = input.description;
        if (input.status) {
          updates.status = input.status;
          if (input.status === "verified") {
            updates.verifiedAt = new Date();
          }
        }

        await db.updateTask(input.id, updates);
        return await db.getTaskById(input.id);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const task = await db.getTaskById(input.id);
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        // Check access
        if (ctx.user?.role !== "admin" && task.assignedToUserId !== ctx.user?.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        return task;
      }),

    markCompleted: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const task = await db.getTaskById(input.id);
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        if (task.assignedToUserId !== ctx.user?.id && ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        await db.updateTask(input.id, {
          isCompleted: true,
          status: "in_progress",
          completedAt: new Date(),
        });

        return await db.getTaskById(input.id);
      }),
  }),

  evidences: router({
    list: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input, ctx }) => {
        const task = await db.getTaskById(input.taskId);
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        if (ctx.user?.role !== "admin" && task.assignedToUserId !== ctx.user?.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        return await db.getTaskEvidences(input.taskId);
      }),

    upload: protectedProcedure
      .input(
        z.object({
          taskId: z.number(),
          fileData: z.string(), // base64
          fileName: z.string(),
          fileType: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const task = await db.getTaskById(input.taskId);
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        if (task.assignedToUserId !== ctx.user?.id && ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const buffer = Buffer.from(input.fileData, "base64");
        const fileKey = `evidences/${input.taskId}/${ctx.user!.id}/${Date.now()}-${input.fileName}`;

        const { url } = await storagePut(fileKey, buffer, input.fileType);

        const evidence = await db.addTaskEvidence({
          taskId: input.taskId,
          userId: ctx.user!.id,
          fileUrl: url,
          fileKey,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize: buffer.length,
        });

        return evidence;
      }),
  }),

  messages: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserMessages(ctx.user!.id);
    }),

    send: adminProcedure
      .input(
        z.object({
          toUserId: z.number(),
          content: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const message = await db.sendMessage({
          fromUserId: ctx.user!.id,
          toUserId: input.toUserId,
          content: input.content,
          isRead: false,
        });
        return message;
      }),

    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markMessageAsRead(input.id);
        return { success: true };
      }),
  }),

  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    block: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.setUserBlockStatus(input.id, true);
        return { success: true };
      }),

    unblock: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.setUserBlockStatus(input.id, false);
        return { success: true };
      }),

    impersonate: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(input.userId);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        // Create session for impersonated user
        const token = auth.generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await db.createSession({
          userId: user.id,
          token,
          expiresAt,
        });

        auth.setSessionCookie(ctx.res, token, ctx.req);
        return { success: true, user };
      }),
  }),
});

export type AppRouter = typeof appRouter;
