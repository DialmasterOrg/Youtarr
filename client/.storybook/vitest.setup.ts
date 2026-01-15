import '@testing-library/jest-dom/vitest';
import { setProjectAnnotations } from '@storybook/react';

import * as previewAnnotations from './preview';

setProjectAnnotations(previewAnnotations);
