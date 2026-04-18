import { createHashRouter } from 'react-router-dom';

export const appRoutes = [
  {
    path: '/',
    load: () => import('./pages/HomePage.jsx'),
  },
  {
    path: '/repo/:owner/:repo',
    load: () => import('./pages/RepoDetailPage.jsx'),
  },
  {
    path: '/repo/:owner/:repo/:prNumber',
    load: () => import('./pages/PRAnalysisPage.jsx'),
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
