import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Успешный вход!");
      setLocation("/");
    },
    onError: (error) => {
      toast.error(error.message || "Ошибка входа");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await loginMutation.mutateAsync({ username, password });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="G Traffic" className="w-16 h-16 object-contain" />
          </div>
          <CardTitle className="text-center text-2xl">G Traffic</CardTitle>
          <CardDescription className="text-center">Система управления заданиями</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Логин</label>
              <Input
                type="text"
                placeholder="Введите логин"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Пароль</label>
              <Input
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Вход...
                </>
              ) : (
                "Вход"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-600 text-center mb-4">Нет аккаунта?</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation("/register")}
              disabled={isLoading}
            >
              Создать аккаунт
            </Button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm">
            <p className="font-semibold text-blue-900 mb-2">Тестовые данные администратора:</p>
            <p className="text-blue-800">Логин: <code className="bg-white px-2 py-1 rounded">admin123</code></p>
            <p className="text-blue-800">Пароль: <code className="bg-white px-2 py-1 rounded">TrafficG232569</code></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
