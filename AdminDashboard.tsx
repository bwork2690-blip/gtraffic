import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { LogOut, Plus, Send, Lock, Unlock, Eye, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [messageToUserId, setMessageToUserId] = useState<number | null>(null);

  const tasksQuery = trpc.tasks.list.useQuery();
  const usersQuery = trpc.users.list.useQuery();
  const createTaskMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Задание создано!");
      setNewTaskTitle("");
      setNewTaskDesc("");
      setSelectedUserId(null);
      tasksQuery.refetch();
    },
  });
  const sendMessageMutation = trpc.messages.send.useMutation({
    onSuccess: () => {
      toast.success("Сообщение отправлено!");
      setMessageContent("");
      setMessageToUserId(null);
    },
  });
  const blockUserMutation = trpc.users.block.useMutation({
    onSuccess: () => {
      toast.success("Пользователь заблокирован!");
      usersQuery.refetch();
    },
  });
  const unblockUserMutation = trpc.users.unblock.useMutation({
    onSuccess: () => {
      toast.success("Пользователь разблокирован!");
      usersQuery.refetch();
    },
  });
  const impersonateMutation = trpc.users.impersonate.useMutation({
    onSuccess: () => {
      toast.success("Вход в аккаунт пользователя!");
      setLocation("/");
    },
  });

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle || !selectedUserId) {
      toast.error("Заполните название и выберите пользователя");
      return;
    }
    await createTaskMutation.mutateAsync({
      title: newTaskTitle,
      description: newTaskDesc || undefined,
      assignedToUserId: selectedUserId,
    });
  };

  const handleSendMessage = async () => {
    if (!messageContent || !messageToUserId) {
      toast.error("Заполните сообщение и выберите пользователя");
      return;
    }
    await sendMessageMutation.mutateAsync({
      toUserId: messageToUserId,
      content: messageContent,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "verified":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle2 className="w-4 h-4" />;
      case "in_progress":
      case "completed":
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Ожидание";
      case "in_progress":
        return "В процессе";
      case "completed":
        return "Выполнено";
      case "verified":
        return "Подтверждено";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="G Traffic" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="font-bold text-lg">G Traffic - Админ-панель</h1>
              <p className="text-sm text-gray-600">Управление заданиями и пользователями</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium">{user?.name || user?.username}</p>
              <p className="text-sm text-gray-600">Администратор</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="tasks" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tasks">Задания</TabsTrigger>
            <TabsTrigger value="users">Пользователи</TabsTrigger>
            <TabsTrigger value="messages">Сообщения</TabsTrigger>
          </TabsList>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Создать новое задание</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Название задания"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Описание (опционально)"
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Назначить пользователю</label>
                  <select
                    value={selectedUserId || ""}
                    onChange={(e) => setSelectedUserId(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Выберите пользователя</option>
                    {usersQuery.data?.map((u) => (
                      <option key={u.id} value={u.id} disabled={u.isBlocked}>
                        {u.name || u.username} {u.isBlocked ? "(заблокирован)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending} className="w-full">
                  {createTaskMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Создание...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Создать задание
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <div>
              <h3 className="text-lg font-semibold mb-4">Все задания</h3>
              {tasksQuery.isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : tasksQuery.data && tasksQuery.data.length > 0 ? (
                <div className="grid gap-4">
                  {tasksQuery.data.map((task) => (
                    <Card key={task.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{task.title}</CardTitle>
                            <CardDescription>{task.description}</CardDescription>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${getStatusColor(task.status)}`}>
                            {getStatusIcon(task.status)}
                            {getStatusText(task.status)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600">
                          Назначено: {usersQuery.data?.find((u) => u.id === task.assignedToUserId)?.name || "Неизвестно"}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-gray-500">Заданий нет</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-4">Управление пользователями</h3>
              {usersQuery.isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : usersQuery.data && usersQuery.data.length > 0 ? (
                <div className="grid gap-4">
                  {usersQuery.data.map((u) => (
                    <Card key={u.id} className={u.isBlocked ? "opacity-60" : ""}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{u.name || u.username}</CardTitle>
                            <CardDescription>{u.email || "Email не указан"}</CardDescription>
                          </div>
                          <div className="text-xs font-semibold px-2 py-1 rounded bg-gray-100">
                            {u.role === "admin" ? "Администратор" : "Пользователь"}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-2 flex-wrap">
                          {u.role !== "admin" && (
                            <>
                              {u.isBlocked ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => unblockUserMutation.mutate({ id: u.id })}
                                >
                                  <Unlock className="w-4 h-4 mr-1" />
                                  Разблокировать
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => blockUserMutation.mutate({ id: u.id })}
                                >
                                  <Lock className="w-4 h-4 mr-1" />
                                  Заблокировать
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => impersonateMutation.mutate({ userId: u.id })}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Войти в аккаунт
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-gray-500">Пользователей нет</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Отправить сообщение пользователю</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Пользователь</label>
                  <select
                    value={messageToUserId || ""}
                    onChange={(e) => setMessageToUserId(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Выберите пользователя</option>
                    {usersQuery.data?.filter((u) => u.role !== "admin").map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.username}
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea
                  placeholder="Текст сообщения"
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={4}
                />
                <Button onClick={handleSendMessage} disabled={sendMessageMutation.isPending} className="w-full">
                  {sendMessageMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Отправить сообщение
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
