# iConn — Real-time Chat App

A full-featured WhatsApp-style messaging app built with **Vite + React + Supabase**.

## Features
- Auth (sign up / sign in)
- Direct messages & group chats
- Real-time messages via Supabase Realtime
- Reply, react (emoji), edit, delete messages
- Typing indicators & online presence
- Profile panel with editable name/status
- Responsive layout

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Create a Supabase project
Go to https://supabase.com → New project.  
Copy your Project URL and anon key from Settings → API.

### 3. Run the schema
Open Supabase dashboard → SQL Editor → paste `supabase-schema.sql` → Run.

### 4. Set env vars
```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 5. Start dev server
```bash
npm run dev
```

## Build
```bash
npm run build   # output in dist/
```
