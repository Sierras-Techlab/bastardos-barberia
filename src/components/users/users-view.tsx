"use client";

import {
  AlertCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import type { FrontendCreateUserInput, FrontendUpdateUserInput } from "@/types/user-commissions";
import type { EmployeeCommercialAgreement, ChairRentalPayment } from "@/types/chair-rental";
import type { PaymentMethod } from "@/types/payment-method";
import { chairRentalClient, ChairRentalApiError } from "@/lib/chair-rentals/client";
import { paymentMethodClient } from "@/lib/payment-methods/client";
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
import { EmployeeAgreementDialog } from "./employee-agreement-dialog";
import { ChairRentalConfirmDialog, ChairRentalVoidDialog } from "./chair-rental-dialogs";
import { ChairRentalHistorySheet } from "./chair-rental-history-sheet";

type UsersViewProps = {
  currentUser: SafeUser;
  currentPeriod: string;
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

export const UsersView = ({ currentUser, currentPeriod }: UsersViewProps) => {
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
  const [agreements, setAgreements] = useState<Record<string, EmployeeCommercialAgreement | null>>({});
  const [rentals, setRentals] = useState<Record<string, ChairRentalPayment | null>>({});
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(() => currentUser.role.name === "owner");
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const [paymentMethodsReloadKey, setPaymentMethodsReloadKey] = useState(0);
  const [agreementUser, setAgreementUser] = useState<SafeUser | null>(null);
  const [agreementPending, setAgreementPending] = useState(false);
  const [rentalUser, setRentalUser] = useState<SafeUser | null>(null);
  const [historyUser, setHistoryUser] = useState<SafeUser | null>(null);
  const [history, setHistory] = useState<ChairRentalPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rentalError, setRentalError] = useState<string | null>(null);
  const [voidPayment, setVoidPayment] = useState<ChairRentalPayment | null>(null);
  const [agreementLoading, setAgreementLoading] = useState(false);
  const [agreementDialogLoading, setAgreementDialogLoading] = useState(false);
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const [rentalLoading, setRentalLoading] = useState(false);
  const [rentalListError, setRentalListError] = useState<string | null>(null);
  const [rentalDataReloadKey, setRentalDataReloadKey] = useState(0);
  const agreementRequestRef = useRef(0);

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
        setAgreements({});
        setRentals({});
        const hasEmployees = result.items.some((user) => user.role.name === "employee");
        setAgreementLoading(hasEmployees);
        setRentalLoading(hasEmployees);
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
    currentPeriod,
  ]);

  // Agreement and rental reads are deliberately independent from the user list.
  useEffect(() => {
    const employees = page?.items.filter((item) => item.role.name === "employee") ?? [];
    let active = true;
    if (!employees.length) {
      return () => { active = false; };
    }
    Promise.all(employees.map(async (employee) => [employee.id, await chairRentalClient.agreement(employee.id)] as const)).then((results) => {
      if (!active) return;
      setAgreements(Object.fromEntries(results));
      setAgreementError(null);
    }).catch((error: unknown) => {
      if (active) setAgreementError(error instanceof Error ? error.message : "No pudimos cargar los acuerdos.");
    }).finally(() => { if (active) setAgreementLoading(false); });
    const loadRentals = async () => {
      const query = (pageNumber: number) => `period=${encodeURIComponent(currentPeriod)}&page=${pageNumber}&pageSize=100`;
      const first = await chairRentalClient.list(query(1));
      const remaining = first.totalPages > 1
        ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) => chairRentalClient.list(query(index + 2))))
        : [];
      return [first, ...remaining].flatMap((result) => result.items);
    };
    loadRentals().then((items) => {
      if (!active) return;
      const next: Record<string, ChairRentalPayment | null> = {};
      items.forEach((item) => { next[item.employeeId] = item; });
      setRentals(next);
      setRentalListError(null);
    }).catch((error: unknown) => { if (active) setRentalListError(error instanceof Error ? error.message : "No pudimos cargar los alquileres."); }).finally(() => { if (active) setRentalLoading(false); });
    return () => { active = false; };
  }, [currentPeriod, page, rentalDataReloadKey]);

  useEffect(() => {
    if (currentUser.role.name !== "owner") return;
    let active = true;
    paymentMethodClient.list()
      .then((methods) => {
        if (!active) return;
        setPaymentMethods(methods);
        setPaymentMethodsError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPaymentMethods([]);
        setPaymentMethodsError(error instanceof Error ? error.message : "No pudimos cargar los medios de pago.");
      })
      .finally(() => { if (active) setPaymentMethodsLoading(false); });
    return () => { active = false; };
  }, [currentUser.role.name, paymentMethodsReloadKey]);

  const summary = useMemo(
    () => summarizeUserPage(page?.items ?? []),
    [page],
  );

  const retryPaymentMethods = () => {
    setPaymentMethodsLoading(true);
    setPaymentMethodsError(null);
    setPaymentMethodsReloadKey((value) => value + 1);
  };

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

  const reloadRentals = () => {
    setAgreementLoading(true);
    setRentalLoading(true);
    setRentalDataReloadKey((value) => value + 1);
  };
  const loadAgreement = (user: SafeUser) => {
    const requestId = agreementRequestRef.current + 1;
    agreementRequestRef.current = requestId;
    setAgreementDialogLoading(true);
    setAgreementError(null);
    chairRentalClient.agreement(user.id)
      .then((agreement) => {
        if (agreementRequestRef.current !== requestId) return;
        setAgreements((current) => ({ ...current, [user.id]: agreement }));
      })
      .catch((error: unknown) => {
        if (agreementRequestRef.current !== requestId) return;
        setAgreementError(error instanceof Error ? error.message : "No pudimos cargar el acuerdo.");
      })
      .finally(() => {
        if (agreementRequestRef.current === requestId) setAgreementDialogLoading(false);
      });
  };
  const openAgreement = (user: SafeUser) => {
    agreementRequestRef.current += 1;
    setAgreementUser(user);
    setRentalError(null);
    setAgreementError(null);
    if (agreements[user.id]) {
      setAgreementDialogLoading(false);
      return;
    }
    loadAgreement(user);
  };
  const saveAgreement = async (value: EmployeeCommercialAgreement) => { if (!agreementUser || agreementDialogLoading || !agreements[agreementUser.id]) return; setAgreementPending(true); setRentalError(null); try { const saved = await chairRentalClient.updateAgreement(agreementUser.id, value); setAgreements((current) => ({ ...current, [agreementUser.id]: saved })); setPage((current) => current ? ({ ...current, items: current.items.map((item) => item.id === agreementUser.id ? { ...item, serviceCommissionEnabled: saved.serviceCommissionEnabled, productCommissionEnabled: saved.productCommissionEnabled, chairRentalEnabled: saved.chairRentalEnabled, monthlyChairRentalAmount: saved.monthlyChairRentalAmount, chairRentalEffectiveFrom: saved.chairRentalEffectiveFrom, chairRentalDueDay: saved.chairRentalDueDay } : item) }) : current); setAgreementError(null); setAgreementUser(null); toast.success("Acuerdo guardado."); reloadRentals(); } catch (error) { setAgreementError(error instanceof Error ? error.message : "No se pudo guardar el acuerdo."); } finally { setAgreementPending(false); } };
  const openHistory = async (user: SafeUser) => { setHistoryUser(user); setHistory([]); setHistoryLoading(true); setRentalError(null); try { setHistory(await chairRentalClient.detail(user.id)); } catch (error) { setRentalError(error instanceof Error ? error.message : "No se pudo cargar el historial."); } finally { setHistoryLoading(false); } };
  const confirmRental = async (methodId: string) => { if (!rentalUser || !rentals[rentalUser.id]) return; setAgreementPending(true); setRentalError(null); try { await chairRentalClient.confirm(rentalUser.id, { period: rentals[rentalUser.id]!.period, paymentMethodId: methodId, requestId: crypto.randomUUID() }); setRentalUser(null); toast.success("Alquiler confirmado."); reloadRentals(); } catch (error) { setRentalError(error instanceof ChairRentalApiError || error instanceof Error ? error.message : "No se pudo confirmar el alquiler."); } finally { setAgreementPending(false); } };
  const voidRental = async (reason: string) => { if (!voidPayment) return; setAgreementPending(true); setRentalError(null); try { await chairRentalClient.void(voidPayment.id, { reason: reason.trim() }); setVoidPayment(null); toast.success("Alquiler anulado."); reloadRentals(); if (historyUser) setHistory(await chairRentalClient.detail(historyUser.id)); } catch (error) { setRentalError(error instanceof Error ? error.message : "No se pudo anular el alquiler."); } finally { setAgreementPending(false); } };

  const openCreate = () => {
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

  const createUser = async (input: FrontendCreateUserInput) => {
    setMutationPending(true);
    setMutationError(null);
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

  const updateUser = async (changes: FrontendUpdateUserInput) => {
    if (!editorUser) return;
    setMutationPending(true);
    setMutationError(null);
    try {
      await updateAdminUser(editorUser.id, changes);
      closeEditor();
      toast.success("Datos del usuario actualizados.");
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
      toast.success("Contraseña actualizada.");
      reloadList();
    } catch (error) {
      handleMutationError(error);
    } finally {
      setMutationPending(false);
    }
  };

  const chooseAction = (action: UserAction, user: SafeUser) => {
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
      toast.success(
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

      {page && (
        <section aria-label="Estado de acuerdos y alquileres" className="rounded-[1.2rem] border border-black/5 bg-white px-4 py-3 text-sm">
          {agreementLoading && <p className="text-zinc-500" role="status">Cargando acuerdos de empleados…</p>}
          {!agreementLoading && !agreementError && page.items.every((user) => user.role.name !== "employee") && <p className="text-zinc-500">No hay empleados en esta página para mostrar acuerdos.</p>}
          {agreementError && <div className="flex flex-col gap-2 text-red-700 sm:flex-row sm:items-center sm:justify-between"><p role="alert">No pudimos cargar los acuerdos: {agreementError}</p><Button type="button" variant="outline" onClick={() => setRentalDataReloadKey((value) => value + 1)} className="rounded-xl">Reintentar acuerdos</Button></div>}
          {rentalLoading && <p className="mt-1 text-zinc-500" role="status">Cargando alquileres del período {currentPeriod}…</p>}
          {rentalListError && <div className="mt-1 flex flex-col gap-2 text-red-700 sm:flex-row sm:items-center sm:justify-between"><p role="alert">No pudimos cargar los alquileres: {rentalListError}</p><Button type="button" variant="outline" onClick={() => setRentalDataReloadKey((value) => value + 1)} className="rounded-xl">Reintentar alquileres</Button></div>}
        </section>
      )}

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
              agreements={agreements}
              rentals={rentals}
              canEditAgreement={currentUser.role.name === "owner"}
              onAgreement={openAgreement}
              onPayRental={(user, rental) => { setRentalError(null); setRentalUser(user); setRentals((current) => ({ ...current, [user.id]: rental })); }}
              onRentalHistory={openHistory}
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
        canEditRates={currentUser.role.name === "owner"}
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
      <EmployeeAgreementDialog key={`agreement-dialog-${agreementUser?.id ?? "closed"}:${JSON.stringify(agreementUser ? agreements[agreementUser.id] ?? null : null)}`} employeeName={agreementUser ? `${agreementUser.firstName} ${agreementUser.lastName}` : ""} agreement={agreementUser ? agreements[agreementUser.id] ?? null : null} agreementLoading={agreementDialogLoading} open={agreementUser !== null} editable={currentUser.role.name === "owner"} pending={agreementPending} error={agreementError ?? rentalError} onRetry={() => agreementUser && loadAgreement(agreementUser)} onClose={() => { agreementRequestRef.current += 1; setAgreementUser(null); setAgreementDialogLoading(false); setAgreementError(null); setRentalError(null); }} onSave={saveAgreement} />
      <ChairRentalConfirmDialog key={`confirm-rental-dialog-${rentalUser?.id ?? "closed"}:${paymentMethods.length}`} payment={rentalUser ? rentals[rentalUser.id] ?? null : null} methods={paymentMethods} methodsLoading={paymentMethodsLoading} methodsError={paymentMethodsError} onRetryMethods={retryPaymentMethods} open={rentalUser !== null} pending={agreementPending} error={rentalError} onClose={() => { setRentalUser(null); setRentalError(null); }} onConfirm={confirmRental} />
      <ChairRentalHistorySheet employeeName={historyUser ? `${historyUser.firstName} ${historyUser.lastName}` : ""} items={history} open={historyUser !== null} loading={historyLoading} error={rentalError} owner={currentUser.role.name === "owner"} onClose={() => { setHistoryUser(null); setRentalError(null); }} onVoid={setVoidPayment} />
      <ChairRentalVoidDialog key={`void-rental-dialog-${voidPayment?.id ?? "closed"}`} payment={voidPayment} open={voidPayment !== null} pending={agreementPending} error={rentalError} onClose={() => { setVoidPayment(null); setRentalError(null); }} onVoid={voidRental} />
    </div>
  );
};
