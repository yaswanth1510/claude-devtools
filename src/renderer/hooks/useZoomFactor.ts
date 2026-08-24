import { useEffect, useState } from 'react';

import { api } from '@renderer/api';
import { createLogger } from '@shared/utils/logger';

const logger = createLogger('Hook:useZoomFactor');

/**
 * Reads current zoom factor and stays subscribed to zoom updates from main.
 */
export function useZoomFactor(): number {
  const [zoomFactor, setZoomFactor] = useState(1);

  useEffect(() => {
    let isMounted = true;

    void api
      .getZoomFactor()
      .then((value) => {
        if (isMounted) {
          setZoomFactor(value);
        }
      })
      .catch((error: unknown) => {
        // Keep default 1 if zoom factor cannot be read.
        logger.error('Failed to read zoom factor, keeping default 1:', error);
      });

    const unsubscribe = api.onZoomFactorChanged((value) => {
      setZoomFactor(value);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return zoomFactor;
}
