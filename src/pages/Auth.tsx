import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Mail, Lock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentTab, setCurrentTab] = useState<'signin' | 'signup'>('signin');
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/note', { replace: true });
      }
    };
    checkAuth();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please sign in instead.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Check your email for the confirmation link!');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password. Please try again.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Welcome back!');
        navigate('/note', { replace: true });
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google Sign-in
  const handleGoogleSignIn = async () => {
    // setIsLoading(true);
    // try {
    //   const { error } = await supabase.auth.signInWithOAuth({
    //     provider: 'google',
    //     options: {
    //       redirectTo: `${window.location.origin}/note`, // Redirect to chat after successful sign-in
    //     },
    //   });

    //   if (error) {
    //     toast.error(`Google sign-in failed: ${error.message}`);
    //   }
    //   // Supabase handles the redirect, so no further action needed here on success
    // } catch (error) {
    //   toast.error('An unexpected error occurred during Google sign-in');
    // } finally {
    //   setIsLoading(false);
    // }
    toast.info("coming soon..")
  };

  return (
    <div className="min-h-screen flex flex-col font-inter relative overflow-hidden
      bg-gray-950 bg-[url('/herobackgroundimg.png')] bg-cover bg-center
      before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-transparent before:via-gray-950/70 before:to-gray-950/90 before:z-0 text-white">
      {/* Main Content Area - Two Columns */}
      <div className="flex flex-grow flex-col lg:flex-row items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        {/* Left Column - Auth Form */}
        <div className="flex-1 flex items-center justify-center w-full lg:w-1/2 p-4">
          <Card className="w-full max-w-md mx-auto bg-gray-900 shadow-2xl rounded-xl overflow-hidden border border-gray-700">
            <CardHeader className="text-center space-y-4 p-6 sm:p-8 pb-4 bg-gray-900">
              <div className="flex items-center justify-center gap-3">
                <img
                  src="/siteimage.png"
                  alt="studdyhub AI Logo"
                  className="h-9 w-9 sm:h-11 sm:w-11 object-contain"
                />
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white">studdyhub AI</h1>
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-white">Welcome Back!</CardTitle>
                <CardDescription className="text-sm sm:text-base text-gray-400 mt-2">
                  Sign in or create an account to continue your learning journey.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as 'signin' | 'signup')} className="w-full">
                <div className="hidden"></div> {/* Hidden TabsList */}

                <TabsContent value="signin" className="space-y-6 mt-0">
                  <div className="space-y-4">
                    <Button
                      variant="outline"
                      onClick={handleGoogleSignIn}
                      className="w-full h-12 rounded-lg border border-gray-600 bg-gray-700 text-gray-100 hover:bg-gray-600 transition-colors duration-200 flex items-center justify-center gap-2"
                      disabled={isLoading}
                    >
                      {/* Google Icon SVG */}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.0003 4.40002C13.6003 4.40002 14.9603 4.96002 16.0003 5.92002L19.0403 2.96002C17.2003 1.28002 14.8003 0.400024 12.0003 0.400024C7.28033 0.400024 3.20033 3.04002 1.28033 7.04002L5.28033 10.0001C6.24033 7.52002 8.96033 5.92002 12.0003 5.92002V4.40002Z" fill="#EA4335" />
                        <path d="M23.6003 12.0001C23.6003 11.2001 23.5203 10.4001 23.3603 9.60009H12.0003V14.4001H18.8003C18.4803 16.0001 17.6003 17.2001 16.4003 18.0001V21.4401H20.8003C23.2003 19.2001 23.6003 15.8401 23.6003 12.0001Z" fill="#4285F4" />
                        <path d="M12.0003 23.6001C14.8003 23.6001 17.2003 22.7201 19.0403 21.4401L16.0003 18.0001C14.9603 18.7201 13.6003 19.2001 12.0003 19.2001C8.96033 19.2001 6.24033 17.6001 5.28033 15.1201L1.28033 18.0801C3.20033 22.0801 7.28033 24.7201 12.0003 24.7201V23.6001Z" fill="#34A853" />
                        <path d="M0.400326 12.0001C0.400326 11.2001 0.480326 10.4001 0.640326 9.60009L4.64033 6.64009C4.32033 7.28009 4.08033 7.92009 3.92033 8.64009H0.400326V12.0001Z" fill="#FBBC04" />
                      </svg>
                      Continue with Google
                    </Button>
                  </div>

                  <div className="relative flex items-center justify-center my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-700" />
                    </div>
                    <div className="relative z-10 bg-gray-900 px-4 text-sm text-gray-400">
                      or
                    </div>
                  </div>

                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="text-sm font-medium text-gray-300">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 h-12 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 bg-gray-800 text-gray-100 dark:focus:border-blue-400"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="signin-password" className="text-sm font-medium text-gray-300">Password</Label>
                        <a href="#" className="text-sm text-blue-400 hover:underline">Forgot Password?</a>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="signin-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 h-12 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 bg-gray-800 text-gray-100 dark:focus:border-blue-400"
                          required
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-blue-700 text-white font-bold text-lg py-3 rounded-lg shadow-lg hover:bg-blue-800 transition-all duration-300 transform hover:scale-[1.005] disabled:opacity-50 disabled:cursor-not-allowed h-12"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </form>
                  <div className="text-center text-sm text-gray-400 mt-4">
                    Don't have an account?{' '}
                    <button
                      onClick={() => setCurrentTab('signup')}
                      className="text-blue-400 hover:underline focus:outline-none"
                      type="button"
                    >
                      Sign Up Now
                    </button>
                  </div>
                </TabsContent>

                <TabsContent value="signup" className="space-y-6 mt-0">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-sm font-medium text-gray-300">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Enter your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="pl-10 h-12 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 bg-gray-800 text-gray-100 dark:focus:border-blue-400"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm font-medium text-gray-300">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 h-12 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 bg-gray-800 text-gray-100 dark:focus:border-blue-400"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm font-medium text-gray-300">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="Create a password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 h-12 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 bg-gray-800 text-gray-100 dark:focus:border-blue-400"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-blue-700 text-white font-bold text-lg py-3 rounded-lg shadow-lg hover:bg-blue-800 transition-all duration-300 transform hover:scale-[1.005] disabled:opacity-50 disabled:cursor-not-allowed h-12"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Creating account...' : 'Create Account'}
                    </Button>
                  </form>
                  <div className="text-center text-sm text-gray-400 mt-4">
                    Already have an account?{' '}
                    <button
                      onClick={() => setCurrentTab('signin')}
                      className="text-blue-400 hover:underline focus:outline-none"
                      type="button"
                    >
                      Sign In
                    </button>
                  </div>
                </TabsContent>
              </Tabs>
              <div className="text-xs text-gray-500 text-center mt-6 space-y-2">
                <p>By continuing, you agree to Supabase's <a href="/terms-of-service" className="text-blue-400 hover:underline">Terms of Service</a> and <a href="/privacy-policy" className="text-blue-400 hover:underline">Privacy Policy</a>.</p>
                <p>and to receive periodic emails with updates.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Testimonial Section (Hidden on small screens) */}
        <div className="flex-1 hidden lg:flex items-center justify-center p-8">
          <div className="max-w-xl text-center lg:text-left space-y-6">
            <blockquote className="text-3xl font-semibold leading-relaxed text-gray-200 before:content-['“'] before:text-5xl before:text-gray-600 before:mr-2 before:align-top after:content-['”'] after:text-5xl after:text-gray-600 after:ml-2 after:align-bottom">
              <p>studdyhub AI has revolutionized my study routine! The ability to automatically summarize lectures and generate flashcards from my notes saves me hours every week. It's like having a personal study assistant that truly understands my needs as a student.</p>
            </blockquote>
            <div className="flex items-center justify-center lg:justify-start gap-3 mt-6">
              <img
                src="/founder.jpg"
                alt="Founder of studdyhub AI"
                className="h-20 w-20 rounded-full object-cover border-2 border-gray-600"
              />
              <span className="text-lg font-medium text-gray-300">A dedicated student & founder</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
