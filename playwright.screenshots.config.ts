import base from './playwright.config'
import { defineConfig } from '@playwright/test'

// The README screenshots (npm run docs:screenshots): the same mock server as the browser tests, but only
// e2e/screenshots/*.shots.ts, which the normal suite never picks up.
export default defineConfig({ ...base, testMatch: '**/*.shots.ts', fullyParallel: false, retries: 0, reporter: 'list' })
