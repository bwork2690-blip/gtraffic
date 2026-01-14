import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { LogOut, Upload, MessageSquare, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState<number | null>(null);

  const tasksQuery = trpc.tasks.list.useQuery();
  const messagesQuery = trpc.messages.list.useQuery();
  const markCompletedMutation = trpc.tasks.markCompleted.useMutation({
    onSuccess: () => {
      toast.success("Задание отмечено как выполненное!");
      tasksQuery.refetch();
    },
  });
  const uploadEvidenceMutation = trpc.evidences.upload.useMutation({
    onSuccess: () => {
      toast.success("Файл загружен успешно!");
      setFileToUpload(null);
      setUploadingTaskId(null);
      tasksQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Ошибка загрузки файла");
    },
  });

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const handleMarkCompleted = async (taskId: number) => {
    await markCompletedMutation.mutateAsync({ id: taskId });
  };

  const handleUploadFile = async (taskId: number) => {
    if (!fileToUpload) {
      toast.error("Выберите файл");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      setUploadingTaskId(taskId);
      await uploadEvidenceMutation.mutateAsync({
        taskId,
        fileData: base64,
        fileName: fileToUpload.name,
        fileType: fileToUpload.type,
      });
    };
    reader.readAsDataURL(fileToUpload);
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
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="G Traffic" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="font-bold text-lg">G Traffic</h1>
              <p className="text-sm text-gray-600">Мои задания</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium">{user?.name || user?.username}</p>
              <p className="text-sm text-gray-600">{user?.email || "Пользователь"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Messages Section */}
        {messagesQuery.data && messagesQuery.data.length > 0 && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Сообщения от администратора
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {messagesQuery.data.map((msg) => (
                <div key={msg.id} className="bg-white p-4 rounded-lg border-l-4 border-blue-600">
                  <p className="text-gray-800">{msg.content}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(msg.createdAt).toLocaleString("ru-RU")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tasks Section */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Мои задания</h2>
          {tasksQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : tasksQuery.data && tasksQuery.data.length > 0 ? (
            <div className="grid gap-4">
              {tasksQuery.data.map((task) => (
                <Card key={task.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
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
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={task.isCompleted}
                          disabled={task.status === "verified"}
                          onChange={() => handleMarkCompleted(task.id)}
                        />
                        <span className="text-sm">Отметить как выполненное</span>
                      </div>

                      {task.isCompleted && task.status !== "verified" && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full">
                              <Upload className="w-4 h-4 mr-2" />
                              Загрузить доказательство
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Загрузить файл</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <input
                                type="file"
                                onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                                className="block w-full text-sm text-gray-500
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-md file:border-0
                                  file:text-sm file:font-semibold
                                  file:bg-indigo-50 file:text-indigo-700
                                  hover:file:bg-indigo-100"
                              />
                              <Button
                                onClick={() => handleUploadFile(task.id)}
                                disabled={!fileToUpload || uploadingTaskId === task.id}
                                className="w-full"
                              >
                                {uploadingTaskId === task.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Загрузка...
                                  </>
                                ) : (
                                  "Загрузить"
                                )}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}

                      {task.completedAt && (
                        <p className="text-xs text-gray-500">
                          Выполнено: {new Date(task.completedAt).toLocaleString("ru-RU")}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">У вас нет заданий</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
