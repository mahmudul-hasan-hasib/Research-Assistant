"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { registerSchema, type RegisterValues } from "../schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/utils/errors";

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { display_name: "", email: "", password: "", confirm_password: "" },
  });

  const onSubmit = async (values: RegisterValues) => {
    try {
      await register.mutateAsync({
        display_name: values.display_name,
        email: values.email,
        password: values.password,
      });
      toast.success("Account created");
      router.replace("/dashboard");
    } catch (error) {
      toast.error("Registration failed", { description: getErrorMessage(error) });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          disabled={register.isPending}
          {...form.register("display_name")}
        />
        {form.formState.errors.display_name && (
          <p className="text-sm text-destructive">{form.formState.errors.display_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={register.isPending}
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          disabled={register.isPending}
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirm password</Label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          disabled={register.isPending}
          {...form.register("confirm_password")}
        />
        {form.formState.errors.confirm_password && (
          <p className="text-sm text-destructive">{form.formState.errors.confirm_password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={register.isPending}>
        {register.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create account
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
