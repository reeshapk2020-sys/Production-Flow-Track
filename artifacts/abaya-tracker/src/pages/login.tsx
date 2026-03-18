import { useState, FormEvent } from "react";
import { Package, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { refetch } = useAppAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      await refetch();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-slate-900 px-8 py-8 text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="h-9 w-9 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-white">AbayaTracker</h1>
            <p className="text-slate-400 mt-1 text-sm">Production Management System</p>
          </div>

          <div className="px-8 py-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-6">Staff Sign In</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-700 font-medium">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  autoComplete="username"
                  className="h-11 rounded-xl border-slate-200 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className="h-11 rounded-xl border-slate-200 focus-visible:ring-primary pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 text-base rounded-xl"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : "Sign In"}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400 mb-3">Admin / Developer access</p>
              <Button
                variant="outline"
                size="sm"
                className="text-slate-500 border-slate-200 hover:text-slate-700 rounded-xl text-xs"
                onClick={() => window.location.href = `${import.meta.env.BASE_URL}api/login`}
              >
                Sign in with Replit
              </Button>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Contact your administrator if you need access.
        </p>
      </div>
    </div>
  );
}
