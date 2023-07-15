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

export const tabs = [
  {
    tab:'Core',
    navTo: 'http://localhost:4200/'
  },
  {
    tab:'Projects',
    navTo: 'http://localhost:4201/project/overview'
  },
  {
    tab:'People',
    navTo: 'http://localhost:4200/people/'
  },
  {
    tab:'Documents',
    navTo: 'http://localhost:4200/documents'
  },
  {
    tab:'Supports',
    navTo: 'http://localhost:4200/suport'
  },
  {
    tab:'Finance',
    navTo: 'http://localhost:4200/finance'
  },
  {
    tab:'Setting',
    navTo: 'http://localhost:4200/setting'
  }
];



/* eslint-disable-next-line */
export interface DesignSystemProps {}


export function Constants(props: DesignSystemProps) {
  return (
      <h1>Welcome to Constnts!</h1>
  );
}

