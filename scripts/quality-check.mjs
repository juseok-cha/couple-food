import { readFileSync } from 'node:fs'

const checks = [
  {
    file: 'src/pages/Home.jsx',
    patterns: [
      'getMyProfile',
      'handleShareInvite',
      'room_members',
    ],
  },
  {
    file: 'src/pages/Room.jsx',
    patterns: [
      'updateFood',
      'markFoodEaten',
      'toggleFoodFavorite',
      'food-tools',
    ],
  },
  {
    file: 'src/pages/Login.jsx',
    patterns: [
      'email rate limit exceeded',
      'resetPasswordForEmail',
    ],
  },
  {
    file: 'supabase/repair_schema.sql',
    patterns: [
      'create or replace function public.create_couple',
      'create or replace function public.get_my_couple',
      'foods: members can update',
      'price_level',
      'room_members',
    ],
  },
  {
    file: '.env.example',
    patterns: [
      'https://your-project-ref.supabase.co',
      'your-supabase-anon-or-publishable-key',
    ],
  },
]

let failed = false

for (const check of checks) {
  const source = readFileSync(check.file, 'utf8')

  for (const pattern of check.patterns) {
    if (!source.includes(pattern)) {
      console.error(`Missing "${pattern}" in ${check.file}`)
      failed = true
    }
  }
}

const filesToScan = [
  'src/pages/Home.jsx',
  'src/pages/Room.jsx',
  'src/pages/Login.jsx',
  'src/index.css',
  'supabase/schema.sql',
  'supabase/repair_schema.sql',
]

for (const file of filesToScan) {
  const source = readFileSync(file, 'utf8')

  if (/^(<<<<<<<|=======|>>>>>>>)$/m.test(source)) {
    console.error(`Conflict marker found in ${file}`)
    failed = true
  }
}

if (failed) {
  process.exit(1)
}

console.log('Quality smoke checks passed.')
