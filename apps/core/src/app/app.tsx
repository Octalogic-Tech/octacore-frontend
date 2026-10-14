import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/app-shell';
import { NotFoundPage } from '@/app/not-found-page';
import { LoginPage } from '@/features/auth/login-page';
import { RequireAuth } from '@/features/auth/require-auth';
import { CategoriesPage } from '@/features/categories/categories-page';
import { ClientsPage } from '@/features/clients/clients-page';
import { TechnologiesPage } from '@/features/technologies/technologies-page';
import { ProjectsPage } from '@/features/projects/projects-page';
import { BillsPage } from '@/features/bills/bills-page';
import { CountriesPage } from '@/features/countries/countries-page';
import { OverviewPage } from '@/features/overview/overview-page';

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="finance/receipts-bills" element={<BillsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="technologies" element={<TechnologiesPage />} />
          <Route path="countries" element={<CountriesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
