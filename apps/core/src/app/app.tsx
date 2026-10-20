import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
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
import { CountriesPage } from '@/features/countries/countries-page';
import { ExpenseTypesPage } from '@/features/expense-types/expense-types-page';
import { ExpensesPage } from '@/features/expenses/expenses-page';
import { InvoicesPage } from '@/features/invoices/invoices-page';
import { OverviewPage } from '@/features/overview/overview-page';
import { PeoplePage } from '@/features/people/people-page';
import { PersonDetailPage } from '@/features/people/person-detail-page';
import { AllocationPage } from '@/features/allocation/allocation-page';
import { LeavePage } from '@/features/leave/leave-page';
import { CashFlowPage } from '@/features/cash-flow/cash-flow-page';
import { CurrencyTaxPage } from '@/features/currency-tax/currency-tax-page';
import { MilestonesPage } from '@/features/milestones/milestones-page';
import { PlannedPage } from '@/features/planned/planned-page';
import { PortfolioPage } from '@/features/portfolio/portfolio-page';
import { ProfitLossPage } from '@/features/profit-loss/profit-loss-page';
import { QuoteEditorPage } from '@/features/quotes/quote-editor-page';
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
          <Route path="quotes" element={<QuotesPage />} />
          <Route path="quotes/new" element={<QuoteEditorPage />} />
          <Route path="quotes/:id" element={<QuoteEditorPage />} />
          <Route path="resources/people" element={<PeoplePage />} />
          <Route path="resources/people/:id" element={<PersonDetailPage />} />
          <Route path="resources/allocation" element={<AllocationPage />} />
          <Route path="resources/leave" element={<LeavePage />} />
          {/* People moved into Resources: a saved link still lands on it. */}
          <Route path="people" element={<Navigate to="/resources/people" replace />} />
          <Route path="finance/invoices" element={<InvoicesPage />} />
          <Route path="finance/expenses" element={<ExpensesPage />} />
          {/* Recurring expenses are now a tab of Expenses: a saved link still lands on it. */}
          <Route path="finance/recurring" element={<Navigate to="/finance/expenses?tab=recurring" replace />} />
          {/* The page used to be Receipts and bills: a saved link still lands on the right page. */}
          <Route path="finance/receipts-bills" element={<Navigate to="/finance/invoices" replace />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="technologies" element={<TechnologiesPage />} />
          <Route path="countries" element={<CountriesPage />} />
          <Route path="expense-types" element={<ExpenseTypesPage />} />
          <Route
            path="users"
            element={
              <RequireRole role="admin">
                <UsersPage />
              </RequireRole>
            }
          />
          {/* Work that is described but not built. */}
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
            <Route path="skills" element={<SkillsPage />} />
            <Route path="cash-flow" element={<CashFlowPage />} />
            <Route path="profit-loss" element={<ProfitLossPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
