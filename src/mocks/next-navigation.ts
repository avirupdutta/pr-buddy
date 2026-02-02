// Mock module for next/navigation to satisfy nextstepjs peer dependency
// https://nextstepjs.com/docs/react/basic-setup

export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  refresh: () => {},
  prefetch: () => Promise.resolve(),
  back: () => {},
  forward: () => {},
});

export const usePathname = () => "";

export const useSearchParams = () => new URLSearchParams();

export const useParams = () => ({});

export const redirect = () => {};

export const notFound = () => {};
