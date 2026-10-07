"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";

type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setUsers((data as UserProfile[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateRole(userId: string, newRole: Role) {
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);
    await loadUsers();
  }

  async function toggleActive(userId: string, current: boolean) {
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ is_active: !current })
      .eq("id", userId);
    await loadUsers();
  }

  if (loading) return <p className="p-8 text-gray-500">Loading...</p>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header title="User Management" />
        <main className="p-8">
          <Card>
            <table className="w-full">
              <thead className="border-b-2">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">Email</th>
                  <th className="text-left p-3 text-sm font-medium">Full name</th>
                  <th className="text-left p-3 text-sm font-medium">Role</th>
                  <th className="text-left p-3 text-sm font-medium">Status</th>
                  <th className="text-left p-3 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm">{user.email}</td>
                    <td className="p-3 text-sm">{user.full_name || "—"}</td>
                    <td className="p-3">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          updateRole(user.id, e.target.value as Role)
                        }
                        className="border rounded px-2 py-1 text-sm"
                      >
                        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <Badge variant={user.is_active ? "success" : "error"}>
                        {user.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Button
                        onClick={() => toggleActive(user.id, user.is_active)}
                        className="text-xs py-1 px-2 bg-gray-600 hover:bg-gray-700"
                      >
                        {user.is_active ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </main>
      </div>
    </div>
  );
}
