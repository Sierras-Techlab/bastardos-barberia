import type { Metadata } from "next";

import { WorkSessionHistory } from "@/components/work-sessions/work-session-history";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requirePageUser } from "@/lib/auth/authorization";
import { userRepository } from "@/lib/users/repository";
import {
  paginatedEmployeeWorkSessionsSchema,
  paginatedManagerWorkSessionsSchema,
} from "@/lib/work-sessions/schemas";
import { listWorkSessions } from "@/lib/work-sessions/service";

export const metadata: Metadata = {
  title: "Presentismo",
  description: "Consultá y administrá las jornadas de Bastardos Barbería.",
};

const listAllEmployeeOptions = async () => {
  const query = { roleId: 3 as const, status: "all" as const, pageSize: 100 };
  const firstPage = await userRepository.list({ ...query, page: 1 });
  const remainingPages =
    firstPage.totalPages > 1
      ? await Promise.all(
          Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
            userRepository.list({ ...query, page: index + 2 }),
          ),
        )
      : [];

  return [firstPage.items, ...remainingPages.map((page) => page.items)]
    .flat()
    .map(({ id, firstName, lastName }) => ({ id, firstName, lastName }))
    .sort((left, right) =>
      `${left.lastName} ${left.firstName}`.localeCompare(
        `${right.lastName} ${right.firstName}`,
        "es-AR",
      ),
    );
};

const WorkSessionsPage = async () => {
  const { user } = await requirePageUser();
  const [result, employeeOptions] = await Promise.all([
    listWorkSessions(user, { page: 1, pageSize: 12 }),
    user.role.name === "employee"
      ? Promise.resolve(null)
      : listAllEmployeeOptions(),
  ]);
  const history =
    user.role.name === "employee" ? (
      <WorkSessionHistory
        viewerRole="employee"
        initialData={paginatedEmployeeWorkSessionsSchema.parse(result)}
      />
    ) : (
      <WorkSessionHistory
        viewerRole={user.role.name}
        initialData={paginatedManagerWorkSessionsSchema.parse(result)}
        employeeOptions={employeeOptions ?? []}
      />
    );

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[#f1f0ed]/90 backdrop-blur-xl xl:rounded-t-[2rem]">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-5 md:px-7 xl:px-8">
          <SidebarTrigger className="-ml-1" />
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {user.role.name === "employee" ? "Mi jornada" : "Jornadas del equipo"}
            </p>
            <h1 className="truncate font-semibold">Presentismo</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5 pb-32 md:px-7 xl:px-8 xl:py-7 xl:pb-28">
        <div className="mb-6 max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Tiempo y producción</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            {user.role.name === "employee"
              ? "Tu jornada, clara de principio a fin"
              : "El pulso operativo de cada jornada"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {user.role.name === "employee"
              ? "Revisá tus entradas, salidas, ventas y comisión sin exponer la economía del negocio."
              : "Filtrá al equipo, compará producción y corregí horarios con un motivo auditado."}
          </p>
        </div>
        {history}
      </main>
    </>
  );
};

export default WorkSessionsPage;
