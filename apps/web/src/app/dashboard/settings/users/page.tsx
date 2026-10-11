"use client";

import { useEffect, useState } from "react";
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
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  async function loadUsers() {
    try {
      const res = await fetch("/api/settings/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de chargement");
      setUsers(data.users || []);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Erreur",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateRole(userId: string, newRole: Role) {
    setSaving(userId);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "✅ Rôle mis à jour" });
        await loadUsers();
      } else {
        setMessage({ type: "error", text: "❌ " + data.error });
      }
    } finally {
      setSaving(null);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function toggleActive(userId: string, current: boolean) {
    setSaving(userId);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, is_active: !current }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: current ? "✅ Utilisateur désactivé" : "✅ Utilisateur activé",
        });
        await loadUsers();
      } else {
        setMessage({ type: "error", text: "❌ " + data.error });
      }
    } finally {
      setSaving(null);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  if (loading) {
    return <div className="p-8 text-gray-500">Loading...</div>;
  }

  return (
    <main className="p-8">
      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

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
                    disabled={saving === user.id}
                    className="border rounded px-2 py-1 text-sm disabled:opacity-50"
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
                    disabled={saving === user.id}
                    className="text-xs py-1 px-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50"
                  >
                    {saving === user.id
                      ? "…"
                      : user.is_active
                      ? "Disable"
                      : "Enable"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}