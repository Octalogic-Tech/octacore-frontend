import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/app-shell';
import { NotFoundPage } from '@/app/not-found-page';
import { PageStub } from '@/app/page-stub';
import { CategoriesPage } from '@/features/categories/categories-page';
import { TechnologiesPage } from '@/features/technologies/technologies-page';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PageStub title="Overview" />} />
        <Route path="projects" element={<PageStub title="Projects" />} />
        <Route path="finance/receipts-bills" element={<PageStub title="Receipts and bills" />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="technologies" element={<TechnologiesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
