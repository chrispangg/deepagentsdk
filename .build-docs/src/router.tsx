import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { NotFound } from '@/components/not-found';

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    basepath: '/ai-sdk-deepagent',
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
    trailingSlash: 'always',
  });
}
