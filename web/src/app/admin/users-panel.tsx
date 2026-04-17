'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@yamma/design-system';

type Role = 'customer' | 'restaurant' | 'admin' | 'driver';

interface AdminUser {
  id: string;
  email?: string | null;
  name: string;
  role: Role;
  createdAt?: string;
}

interface RowState {
  role: Role;
  saving: boolean;
}

function UserRow({
  user,
  rowState,
  onRoleChange,
  onSave,
}: {
  user: AdminUser;
  rowState: RowState;
  onRoleChange: (role: Role) => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--yamma-border)] bg-[var(--yamma-surface)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-[var(--yamma-text)]">{user.name}</p>
          <p className="text-sm text-[var(--yamma-text-subtle)]">{user.email ?? 'No email'}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={rowState.role}
            onChange={(e) => onRoleChange(e.target.value as Role)}
            className="rounded-lg border border-[var(--yamma-border-muted)] bg-[var(--yamma-popover)] px-3 py-2 text-sm text-[var(--yamma-text-secondary)]"
          >
            <option value="customer">Buyer</option>
            <option value="restaurant">Seller</option>
            <option value="driver">Driver</option>
            <option value="admin">Admin</option>
          </select>
          <Button size="sm" onClick={onSave} loading={rowState.saving}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadUsers() {
    setLoading(true);
    setError('');
    const res = await fetch('/api/users?roles=customer,restaurant', { credentials: 'include' });
    const data = await res.json().catch(() => []);
    if (!res.ok || !Array.isArray(data)) {
      setError('Could not load users right now.');
      setLoading(false);
      return;
    }

    setUsers(data);
    const nextRows: Record<string, RowState> = {};
    for (const u of data) nextRows[u.id] = { role: u.role, saving: false };
    setRows(nextRows);
    setLoading(false);
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const buyers = useMemo(() => users.filter((u) => u.role === 'customer'), [users]);
  const sellers = useMemo(() => users.filter((u) => u.role === 'restaurant'), [users]);

  async function saveRole(userId: string) {
    const state = rows[userId];
    if (!state) return;

    setError('');
    setSuccess('');
    setRows((prev) => ({ ...prev, [userId]: { ...prev[userId], saving: true } }));

    const res = await fetch(`/api/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role: state.role }),
    });
    const data = await res.json().catch(() => ({}));

    setRows((prev) => ({ ...prev, [userId]: { ...prev[userId], saving: false } }));

    if (!res.ok) {
      setError(data?.message ?? 'Failed to update user role.');
      return;
    }

    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, role: state.role } : user))
    );
    setSuccess('User role updated successfully.');
  }

  return (
    <div className="mt-8 space-y-8">
      {loading && <p className="text-[var(--yamma-text-subtle)]">Loading users...</p>}
      {error && <p className="text-sm text-[#ef4444]">{error}</p>}
      {success && <p className="text-sm text-[#22c55e]">{success}</p>}

      {!loading && (
        <>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--yamma-text)]">Buyers</h2>
            {buyers.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--yamma-border-muted)] bg-[var(--yamma-surface-elevated)] px-5 py-6 text-[var(--yamma-text-subtle)]">
                No buyers found.
              </p>
            ) : (
              <div className="space-y-3">
                {buyers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    rowState={rows[user.id] ?? { role: user.role, saving: false }}
                    onRoleChange={(role) =>
                      setRows((prev) => ({ ...prev, [user.id]: { ...prev[user.id], role } }))
                    }
                    onSave={() => void saveRole(user.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--yamma-text)]">Sellers</h2>
            {sellers.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--yamma-border-muted)] bg-[var(--yamma-surface-elevated)] px-5 py-6 text-[var(--yamma-text-subtle)]">
                No sellers found.
              </p>
            ) : (
              <div className="space-y-3">
                {sellers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    rowState={rows[user.id] ?? { role: user.role, saving: false }}
                    onRoleChange={(role) =>
                      setRows((prev) => ({ ...prev, [user.id]: { ...prev[user.id], role } }))
                    }
                    onSave={() => void saveRole(user.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
