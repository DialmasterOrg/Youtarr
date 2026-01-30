import { useMediaQuery } from '@mui/material';

export function useBreakpoint(maxWidth = 768) {
  return useMediaQuery(`(max-width:${maxWidth}px)`);
}
