import { createHashRouter } from 'react-router-dom';

export const appRoutes = [
  {
    path: '/',
    load: () => import('./pages/HomePage.jsx'),
  },
  {
    path: '/browse',
    load: () => import('./pages/BrowsePage.jsx'),
  },
  {
    path: '/browse/:owner',
    load: () => import('./pages/BrowsePage.jsx'),
  },
  {
    path: '/browse/:owner/:repo',
    load: () => import('./pages/BrowsePage.jsx'),
  },
  {
    path: '/analysis',
    load: () => import('./pages/AnalysisPage.jsx'),
  },
  {
    path: '/analysis/:owner/:repo',
    load: () => import('./pages/AnalysisPage.jsx'),
  },
  {
    path: '/analysis/:owner/:repo/:runId',
    load: () => import('./pages/AnalysisPage.jsx'),
  },
  {
    path: '/overview',
    load: () => import('./pages/OverviewPage.jsx'),
  },
  {
    path: '*',
    load: () => import('./pages/HomePage.jsx'),
  },
];

export function createAppRouter() {
  return createHashRouter(
    appRoutes.map(route => ({
      path: route.path,
      async lazy() {
        const module = await route.load();
        return { Component: module.default };
      },
    }))
  );
}
