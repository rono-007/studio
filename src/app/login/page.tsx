
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { app } from '@/lib/firebase';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';

const auth = getAuth(app);

const signupSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }),
  email: z.string().email({ message: "Invalid email address." }),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "" },
  });

  // A dummy password will be used since we are not asking the user for one.
  // In a real-world scenario, you would implement a passwordless (e.g., magic link) flow.
  const handleSignup = async (data: SignupFormValues) => {
    setIsLoading(true);
    try {
      // Using a dummy password for the backend requirement.
      const dummyPassword = Math.random().toString(36).slice(-8);
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, dummyPassword);
      await updateProfile(userCredential.user, { displayName: data.name });
      await sendEmailVerification(userCredential.user);
      
      toast({
        title: "Signup Successful",
        description: "A verification email has been sent. Please check your inbox to verify your account.",
      });
      router.push('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error.code === 'auth/email-already-in-use' 
          ? "This email is already in use. Please use a different email."
          : (error.message || "An unexpected error occurred."),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Create an Account</CardTitle>
          <CardDescription>
            Sign up to get full access to the chatbot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Name</Label>
              <Input id="signup-name" {...signupForm.register("name")} placeholder="John Doe" />
               {signupForm.formState.errors.name && <p className="text-destructive text-sm">{signupForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" {...signupForm.register("email")} placeholder="m@example.com" />
               {signupForm.formState.errors.email && <p className="text-destructive text-sm">{signupForm.formState.errors.email.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
               {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               Sign Up
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
