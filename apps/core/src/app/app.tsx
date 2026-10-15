import { Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/app-shell';
import { NotFoundPage } from '@/app/not-found-page';
import { LoginPage } from '@/features/auth/login-page';
import { RequireAuth } from '@/features/auth/require-auth';
import { RequireRole } from '@/features/auth/require-role';
import { CategoriesPage } from '@/features/categories/categories-page';
import { ClientsPage } from '@/features/clients/clients-page';
import { TechnologiesPage } from '@/features/technologies/technologies-page';
import { ProjectDetailPage } from '@/features/projects/project-detail-page';
import { ProjectsPage } from '@/features/projects/projects-page';
import { BillsPage } from '@/features/bills/bills-page';
import { CountriesPage } from '@/features/countries/countries-page';
import { OverviewPage } from '@/features/overview/overview-page';
import { AllocationPage } from '@/features/allocation/allocation-page';
import { CashFlowPage } from '@/features/cash-flow/cash-flow-page';
import { CurrencyTaxPage } from '@/features/currency-tax/currency-tax-page';
import { MilestonesPage } from '@/features/milestones/milestones-page';
import { PlannedPage } from '@/features/planned/planned-page';
import { PortfolioPage } from '@/features/portfolio/portfolio-page';
import { ProfitLossPage } from '@/features/profit-loss/profit-loss-page';
import { QuotesPage } from '@/features/quotes/quotes-page';
import { RecurringInvoicesPage } from '@/features/recurring-invoices/recurring-invoices-page';
import { SkillsPage } from '@/features/skills/skills-page';
import { UsersPage } from '@/features/users/users-page';

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="finance/receipts-bills" element={<BillsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="technologies" element={<TechnologiesPage />} />
          <Route path="countries" element={<CountriesPage />} />
          <Route
            path="users"
            element={
              <RequireRole role="admin">
                <UsersPage />
              </RequireRole>
            }
          />
          {/* Work that is described but not built. Money in cents has no page, so it is on the index only. */}
          <Route
            path="planned"
            element={
              <RequireRole role="admin">
                <Outlet />
              </RequireRole>
            }
          >
            <Route index element={<PlannedPage />} />
            <Route path="currency-tax" element={<CurrencyTaxPage />} />
            <Route path="milestones" element={<MilestonesPage />} />
            <Route path="recurring-invoices" element={<RecurringInvoicesPage />} />
            <Route path="allocation" element={<AllocationPage />} />
            <Route path="skills" element={<SkillsPage />} />
            <Route path="cash-flow" element={<CashFlowPage />} />
            <Route path="profit-loss" element={<ProfitLossPage />} />
            <Route path="quotes" element={<QuotesPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
