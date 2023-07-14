import CoreOverview from '../../../../apps/core/src/app/CoreOverview';
import ProjectOverview from '../../../../apps/projects/src/app/components/ProjectOverview';
import ProjectTechnology from '../../../../apps/projects/src/app/components/ProjectTechnology';
import ProjectIndustry from '../../../../apps/projects/src/app/components/ProjectIndustry';

export const coreRoutes = [
  { path: '/', component: CoreOverview },
];

export const projectRoutes = [
  { path: '/projects/overview', component: ProjectOverview },
  { path: '/projects/technology', component: ProjectTechnology },
  { path: '/projects/industry', component: ProjectIndustry },
];

