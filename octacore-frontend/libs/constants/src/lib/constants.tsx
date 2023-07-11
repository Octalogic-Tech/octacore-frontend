
const Route1Component = () => {
  return <h1>Route 1</h1>;
};

const Route2Component = () => {
  return <h1>Route 2</h1>;
};


/* eslint-disable-next-line */
export const coreRoutes = [
  { path: '/', component: Route1Component },
  { path: '/route2', component: Route2Component },
];


export default coreRoutes;


