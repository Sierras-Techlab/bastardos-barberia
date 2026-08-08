"use client";

import {
  AlertCircle,
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CreateUserInput, UpdateUserInput } from "@/lib/auth/schemas";
import type { PaginatedUsers, Role, SafeUser } from "@/lib/auth/types";
import {
  AdminApiError,
  createAdminUser,
  deleteAdminUser,
  listAdminRoles,
  listAdminUsers,
  resetAdminUserPassword,
  setAdminUserActive,
  updateAdminUser,
} from "@/lib/users/client";
import { summarizeUserPage } from "@/lib/users/presentation";
import {
  UserFilters,
  type UserFiltersValue,
} from "./user-filters";
import {
  UserConfirmDialog,
  type ConfirmUserAction,
} from "./user-confirm-dialog";
import { UserEditorDialog } from "./user-editor-dialog";
import { UserList, type UserAction } from "./user-list";
import { UserPasswordDialog } from "./user-password-dialog";

type UsersViewProps = {
  currentUser: SafeUser;
};

const initialFilters: UserFiltersValue = {
  search: "",
  roleId: "all",
  status: "all",
};

const LoadingList = () => (
  <div
    aria-label="Cargando usuarios"
    className="overflow-hidden rounded-[1.5rem] border border-black/5 bg-white"
  >
    {Array.from({ length: 5 }, (_, index) => (
      <div
        key={index}
        className="flex items-center gap-3 border-b border-black/5 px-5 py-4 last:border-0"
      >
        <span className="size-10 animate-pulse rounded-full bg-zinc-100" />
        <span className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
        <span className="ml-auto h-7 w-20 animate-pulse rounded-full bg-zinc-100" />
      </div>
    ))}
  </div>
);

export const UsersView = ({ currentUser }: UsersViewProps) => {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [rolesReloadKey, setRolesReloadKey] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [page, setPage] = useState<PaginatedUsers | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editorUser, setEditorUser] = useState<SafeUser | null>(null);
  const [createdUser, setCreatedUser] = useState<SafeUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<SafeUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmUserAction | null>(null);
  const [confirmUser, setConfirmUser] = useState<SafeUser | null>(null);
  const [mutationPending, setMutationPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(filters.search.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [filters.search]);

  useEffect(() => {
    let active = true;
    listAdminRoles()
      .then((result) => {
        if (!active) return;
        setRoles(result);
        setRolesError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof AdminApiError && error.status === 401) {
          router.replace("/login");
        } else if (error instanceof AdminApiError && error.status === 403) {
          router.replace("/");
        } else {
          setRoles([]);
          setRolesError(
            error instanceof Error
              ? error.message
              : "No pudimos cargar los roles.",
          );
        }
      })
      .finally(() => {
        if (active) setRolesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [rolesReloadKey, router]);

  useEffect(() => {
    const controller = new AbortController();

    listAdminUsers({
      page: pageNumber,
      pageSize: 20,
      search: debouncedSearch || undefined,
      roleId: filters.roleId === "all"
        ? undefined
        : Number(filters.roleId) as 1 | 2 | 3,
      status: filters.status,
    }, controller.signal)
      .then((result) => {
        const nearestPage = Math.max(result.totalPages, 1);
        if (result.page > nearestPage) {
          setPageNumber(nearestPage);
          setLoading(true);
          return;
        }
        setPage(result);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof AdminApiError && error.status === 401) {
          router.replace("/login");
          return;
        }
        if (error instanceof AdminApiError && error.status === 403) {
          router.replace("/");
          return;
        }
        setListError(
          error instanceof Error
            ? error.message
            : "No pudimos cargar los usuarios.",
        );
        setLoading(false);
      });

    return () => controller.abort();
  }, [
    debouncedSearch,
    filters.roleId,
    filters.status,
    pageNumber,
    reloadKey,
    router,
  ]);

  const summary = useMemo(
    () => summarizeUserPage(page?.items ?? []),
    [page],
  );

  const changeFilters = (next: UserFiltersValue) => {
    setLoading(true);
    setListError(null);
    setFilters(next);
    setPageNumber(1);
  };

  const clearFilters = () => {
    setLoading(true);
    setListError(null);
    setFilters(initialFilters);
    setDebouncedSearch("");
    setPageNumber(1);
  };

  const reloadList = () => {
    setLoading(true);
    setListError(null);
    setReloadKey((value) => value + 1);
  };

  const reloadRoles = () => {
    setRolesLoading(true);
    setRolesError(null);
    setRolesReloadKey((value) => value + 1);
  };

  const handleMutationError = (error: unknown) => {
    if (error instanceof AdminApiError && error.status === 401) {
      router.replace("/login");
      return;
    }
    if (error instanceof AdminApiError && error.status === 403) {
      router.replace("/");
      return;
    }
    setMutationError(
      error instanceof Error
        ? error.message
        : "No se pudo completar la operación.",
    );
  };

  const openCreate = () => {
    setSuccessNotice(null);
    setEditorUser(null);
    setCreatedUser(null);
    setMutationError(null);
    setEditorMode("create");
  };

  const closeEditor = () => {
    setEditorMode(null);
    setEditorUser(null);
    setCreatedUser(null);
    setMutationError(null);
  };

  const createUser = async (input: CreateUserInput) => {
    setMutationPending(true);
    setMutationError(null);
    setSuccessNotice(null);
    try {
      const result = await createAdminUser(input);
      setCreatedUser(result);
      reloadList();
      return true;
    } catch (error) {
      handleMutationError(error);
      return false;
    } finally {
      setMutationPending(false);
    }
  };

  const updateUser = async (changes: UpdateUserInput) => {
    if (!editorUser) return;
    setMutationPending(true);
    setMutationError(null);
    try {
      await updateAdminUser(editorUser.id, changes);
      closeEditor();
      setSuccessNotice("Datos del usuario actualizados.");
      reloadList();
    } catch (error) {
      handleMutationError(error);
    } finally {
      setMutationPending(false);
    }
  };

  const resetPassword = async (password: string) => {
    if (!passwordUser) return;
    setMutationPending(true);
    setMutationError(null);
    try {
      await resetAdminUserPassword(passwordUser.id, password);
      setPasswordUser(null);
      setSuccessNotice("Contraseña actualizada.");
      reloadList();
    } catch (error) {
      handleMutationError(error);
    } finally {
      setMutationPending(false);
    }
  };

  const chooseAction = (action: UserAction, user: SafeUser) => {
    setSuccessNotice(null);
    setMutationError(null);
    if (action === "edit") {
      setEditorUser(user);
      setCreatedUser(null);
      setEditorMode("edit");
    }
    if (action === "password") setPasswordUser(user);
    if (
      action === "activate"
      || action === "deactivate"
      || action === "delete"
    ) {
      setConfirmUser(user);
      setConfirmAction(action);
    }
  };

  const closeConfirmation = () => {
    setConfirmAction(null);
    setConfirmUser(null);
    setMutationError(null);
  };

  const confirmUserAction = async () => {
    if (!confirmAction || !confirmUser) return;
    setMutationPending(true);
    setMutationError(null);
    try {
      if (confirmAction === "delete") {
        await deleteAdminUser(confirmUser.id);
      } else {
        await setAdminUserActive(
          confirmUser.id,
          confirmAction === "activate",
        );
      }
      setSuccessNotice(
        confirmAction === "delete"
          ? "Usuario eliminado."
          : confirmAction === "activate"
            ? "Usuario activado."
            : "Usuario desactivado.",
      );
      closeConfirmation();
      reloadList();
    } catch (error) {
      handleMutationError(error);
    } finally {
      setMutationPending(false);
    }
  };

  const totalLabel = summary.total === 1
    ? "1 en esta página"
    : summary.total + " en esta página";

  return (
    <div className="mx-auto w-full max-w-[94rem] space-y-5">
      <header className="relative overflow-hidden rounded-[1.8rem] bg-[#19191b] px-5 py-6 text-white shadow-[0_30px_80px_-55px_rgba(0,0,0,0.8)] sm:px-7 sm:py-7">
        <div
          aria-hidden="true"
          className="absolute -top-20 -right-16 size-60 rounded-full border-[38px] border-white/[0.025]"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[0.65rem] font-bold tracking-[0.18em] text-white/40 uppercase">
              <ShieldCheck className="size-3.5 text-primary" />
              Administración · Equipo
            </p>
            <h1 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
              Usuarios
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
              Altas, accesos y estado del equipo en un solo lugar.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            disabled={rolesLoading || roles.length === 0}
            aria-describedby={rolesError ? "roles-load-error" : undefined}
            onClick={openCreate}
            className="h-11 rounded-xl px-4 shadow-lg shadow-red-950/20"
          >
            <Plus />
            Nuevo usuario
          </Button>
        </div>
      </header>

      {rolesError && (
        <section
          id="roles-load-error"
          role="alert"
          className="flex flex-col gap-3 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            <span className="font-medium">{rolesError}</span>{" "}
            No se pueden crear ni editar usuarios hasta recuperarlos.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={rolesLoading}
            onClick={reloadRoles}
            className="shrink-0 rounded-xl bg-white"
          >
            <RefreshCw className={rolesLoading ? "animate-spin" : ""} />
            Reintentar roles
          </Button>
        </section>
      )}

      {successNotice && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          <CheckCircle2 className="size-4" />
          {successNotice}
        </p>
      )}

      <section aria-label="Resumen de la página" className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-[1.3rem] border border-black/5 bg-white p-4">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
            <UsersRound className="size-5" />
          </span>
          <div>
            <p className="text-xl font-bold tracking-tight">{totalLabel}</p>
            <p className="text-xs text-zinc-500">Resultados visibles</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-[1.3rem] border border-black/5 bg-white p-4">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <UserCheck className="size-5" />
          </span>
          <div>
            <p className="text-xl font-bold tracking-tight">{summary.active} activos</p>
            <p className="text-xs text-zinc-500">Con acceso habilitado</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-[1.3rem] border border-black/5 bg-white p-4">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <UserRoundX className="size-5" />
          </span>
          <div>
            <p className="text-xl font-bold tracking-tight">{summary.inactive} inactivos</p>
            <p className="text-xs text-zinc-500">Sin acceso al sistema</p>
          </div>
        </div>
      </section>

      <UserFilters
        roles={roles}
        value={filters}
        onChange={changeFilters}
        onClear={clearFilters}
      />

      {loading && !page ? (
        <LoadingList />
      ) : listError ? (
        <section
          role="alert"
          className="flex min-h-64 flex-col items-center justify-center rounded-[1.5rem] border border-red-100 bg-white px-6 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertCircle className="size-5" />
          </span>
          <h2 className="mt-4 font-semibold">No pudimos cargar los usuarios</h2>
          <p className="mt-1 max-w-md text-sm text-zinc-500">{listError}</p>
          <Button
            type="button"
            variant="outline"
            onClick={reloadList}
            className="mt-4 rounded-xl"
          >
            <RefreshCw /> Reintentar
          </Button>
        </section>
      ) : page && page.items.length > 0 ? (
        <>
          <div className={loading ? "pointer-events-none opacity-60" : ""}>
            <UserList
              users={page.items}
              currentUserId={currentUser.id}
              onAction={chooseAction}
            />
          </div>
          <footer className="flex flex-col gap-3 rounded-[1.2rem] px-1 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {page.total} {page.total === 1 ? "usuario" : "usuarios"} · Página {page.page} de {Math.max(page.totalPages, 1)}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page.page <= 1 || loading}
                onClick={() => {
                  setLoading(true);
                  setPageNumber((value) => Math.max(1, value - 1));
                }}
                className="rounded-xl bg-white"
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={page.page >= page.totalPages || loading}
                onClick={() => {
                  setLoading(true);
                  setPageNumber((value) => value + 1);
                }}
                className="rounded-xl bg-white"
              >
                Siguiente
              </Button>
            </div>
          </footer>
        </>
      ) : (
        <section className="flex min-h-64 flex-col items-center justify-center rounded-[1.5rem] border border-black/5 bg-white px-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
            <UsersRound className="size-5" />
          </span>
          <h2 className="mt-4 font-semibold">No encontramos usuarios</h2>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            Probá cambiando la búsqueda o limpiando los filtros aplicados.
          </p>
          <Button
            type="button"
            variant="outline"
            aria-label="Restablecer filtros"
            onClick={clearFilters}
            className="mt-4 rounded-xl"
          >
            <RefreshCw /> Limpiar filtros
          </Button>
        </section>
      )}

      <UserEditorDialog
        key={(editorMode ?? "closed") + ":" + (editorUser?.id ?? "new")}
        mode={editorMode}
        user={editorUser}
        roles={roles}
        createdUser={createdUser}
        pending={mutationPending}
        error={mutationError}
        onClose={closeEditor}
        onCreate={createUser}
        onUpdate={updateUser}
      />

      <UserPasswordDialog
        key={passwordUser?.id ?? "closed"}
        user={passwordUser}
        pending={mutationPending}
        error={mutationError}
        onClose={() => {
          setPasswordUser(null);
          setMutationError(null);
        }}
        onSubmit={resetPassword}
      />

      <UserConfirmDialog
        action={confirmAction}
        user={confirmUser}
        pending={mutationPending}
        error={mutationError}
        onClose={closeConfirmation}
        onConfirm={confirmUserAction}
      />
    </div>
  );
};
