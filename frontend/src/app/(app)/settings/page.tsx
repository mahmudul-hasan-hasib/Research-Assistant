"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/features/workspace/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/utils/format";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and workspace preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your profile details.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Display name</dt>
              <dd className="font-medium">{user?.display_name}</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user?.email}</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium capitalize">{user?.role}</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium capitalize">{user?.plan}</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium">{formatDate(user?.created_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose how Insight looks for you.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm">Theme</p>
          <ThemeToggle />
        </CardContent>
      </Card>
    </div>
  );
}
