import type { ProjectNode } from './types';

/**
 * Every claim here should survive a follow-up question in an interview.
 * Ownership is stated in plain text, never implied by styling.
 * No screenshots, logs, or vendor names anywhere — NDA constraint.
 */
export const projects: ProjectNode[] = [
  // ---------------------------------------------------------------
  // Through-hole automation platform (SEL) — built solo
  // ---------------------------------------------------------------
  {
    id: 'th-supervisor',
    slug: 'station-supervisor',
    title: 'Station supervisor',
    clusterId: 'throughhole',
    ownership: 'sole',
    ownershipNote: 'Sole developer.',
    oneLine: 'Decision layer for through-hole machine automation, running across 7 machines.',
    body: [
      'The supervisor is the top tier of a three-tier automation platform driving through-hole placement machines. It receives messages from the line, decides what logic the situation calls for, and instructs the worker below it. Machine-originated messages bubble back up the same path.',
      'Splitting decision-making out from machine communication means the logic can be reasoned about and changed without touching protocol code, and a single supervisor can coordinate a station whose lower tiers know nothing about why they are being asked to do something.',
      'Containerised and deployed on Kubernetes through a sister team\'s monorepo. This platform was its first consumer — I drove the containerisation and adoption rather than building the deployment platform itself.',
    ],
    metrics: [
      { value: '7', label: 'machines in production' },
      { value: '3', label: 'tier topology', note: 'supervisor, worker, client' },
    ],
    techIds: ['csharp', 'rabbitmq', 'docker', 'kubernetes', 'helm', 'jenkins', 'ipc-cfx'],
    size: 'major',
  },
  {
    id: 'th-worker',
    slug: 'station-worker',
    title: 'Station worker',
    clusterId: 'throughhole',
    ownership: 'sole',
    ownershipNote: 'Sole developer.',
    oneLine: 'Executes supervisor instructions and publishes machine messages upward.',
    body: [
      'The worker hosts the machine client and sits between decision-making and protocol. It receives instructions from the supervisor over RabbitMQ, tells the client what to send, and publishes messages coming back off the machine upward.',
      'Keeping the worker thin — translation and transport, no business logic — is what allows the same worker shape to be reused as machine types are added.',
    ],
    metrics: [],
    techIds: ['csharp', 'rabbitmq', 'docker', 'kubernetes'],
    size: 'standard',
  },
  {
    id: 'th-client',
    slug: 'machine-client',
    title: 'Machine client',
    clusterId: 'throughhole',
    ownership: 'sole',
    ownershipNote: 'Sole developer.',
    oneLine: 'Speaks the machine\'s native protocol over TCP.',
    body: [
      'The client is the only component that knows the machine\'s native protocol. It is consumed as a library inside the worker, translating instructions down to the machine over TCP and passing machine-originated messages back up.',
      'Isolating protocol knowledge in one library means a new machine type needs a new client, not a new platform. Reconnect, backoff, and heartbeat handling live here so that a dropped socket recovers without operator intervention.',
    ],
    metrics: [],
    techIds: ['csharp', 'tcp', 'ipc-cfx', 'smema'],
    size: 'standard',
  },

  // ---------------------------------------------------------------
  // Selective solder line (SEL)
  // ---------------------------------------------------------------
  {
    id: 'solder-driver',
    slug: 'selective-solder-driver',
    title: 'Selective solder driver',
    clusterId: 'solder',
    ownership: 'contributor',
    ownershipNote: 'Contributor. Built with the team.',
    oneLine: 'Gates machine entry on board identity, cutting cycle time 18%.',
    body: [
      'The terminal service in a three-service pipeline that automates selective solder program selection. It receives resolved board data, gates machine entry on the returned program and revision, and enables per-revision program targeting — work that previously required an operator to select the correct program by hand.',
      'Failures publish structured error events to a dedicated exchange, so an operator sees the specific reason a board was rejected and can resolve it without escalating to engineering. On a board-eligibility failure the driver withholds the SMEMA handshake and holds the machine in a safe wait state rather than failing open and letting an unverified board through.',
      'Running continuously in production since launch.',
    ],
    metrics: [
      { value: '18%', label: 'cycle time reduction', note: '+60 boards per day' },
    ],
    techIds: ['csharp', 'rabbitmq', 'ipc-cfx', 'smema', 'tcp', 'rest', 'azure', 'splunk'],
    size: 'major',
  },
  {
    id: 'board-data-service',
    slug: 'board-data-service',
    title: 'Board data service',
    aka: 'Batch Service',
    clusterId: 'solder',
    ownership: 'contributor',
    ownershipNote: 'Contributor. Built with the team.',
    oneLine: 'Turns a barcode into the program and revision the machine needs.',
    body: [
      'Sits between the scanner and the solder driver, resolving board identity against internal REST services — scan data, route completion, route creation.',
      'Isolating every external API call in one service means the driver stays a protocol component. It never has to know how board data is fetched, only what came back.',
    ],
    metrics: [],
    techIds: ['csharp', 'rabbitmq', 'rest'],
    size: 'standard',
  },
  {
    id: 'scanner-driver',
    slug: 'scanner-driver',
    title: 'Scanner driver',
    clusterId: 'solder',
    ownership: 'contributor',
    ownershipNote: 'Contributor. Built with the team.',
    oneLine: 'Entry point of the line — barcode scans onto the message bus.',
    body: [
      'Talks to the barcode scanner over TCP and publishes scans to RabbitMQ. It is the first service in the solder pipeline and the point where a physical board becomes a message.',
    ],
    metrics: [],
    techIds: ['csharp', 'rabbitmq', 'tcp'],
    size: 'standard',
  },

  // ---------------------------------------------------------------
  // Preventive maintenance platform (SEL)
  // ---------------------------------------------------------------
  {
    id: 'maintenance-client',
    slug: 'preventive-maintenance-client',
    title: 'Preventive maintenance platform',
    aka: 'PM Log',
    clusterId: 'maintenance',
    ownership: 'sole',
    ownershipNote: 'Sole frontend developer. Schema and API design lead.',
    oneLine: 'Scheduling and execution tracking for machine maintenance, used across 30%+ of manufacturing.',
    body: [
      'A React platform for planning and recording preventive maintenance, replacing paper and spreadsheet tracking. It has two distinct faces. Administrators author and maintain the maintenance definitions; operators work through what is actually due.',
      'The data model is a four-level hierarchy — machine, checklist, section, task — and the administrative side allows editing at any level of it. You can open a checklist, edit down through its sections to individual tasks, and revert the entire tree of changes in one action. Making that feel immediate meant caching 10k+ ID-linked records in Jotai and treating the client cache as the working copy, with the server reconciled on commit rather than on every keystroke.',
      'The operator view answers a different question: what needs doing first, what is coming up, and which line and machine it belongs to. Same data, ordered by urgency instead of by structure.',
    ],
    metrics: [
      { value: '30%+', label: 'of manufacturing using it' },
      { value: '10k+', label: 'records cached client-side' },
      { value: '4', label: 'level hierarchy', note: 'machine, checklist, section, task' },
    ],
    techIds: ['react', 'typescript', 'jotai', 'tailwind'],
    size: 'major',
  },
  {
    id: 'maintenance-services',
    slug: 'preventive-maintenance-services',
    title: 'Preventive maintenance services',
    clusterId: 'maintenance',
    ownership: 'lead',
    ownershipNote: 'Schema and API contract design lead. Implementation shared.',
    oneLine: 'Relational schema and API contracts behind the maintenance platform.',
    body: [
      'The backing schema models a four-level many-to-many hierarchy, frequency-based scheduling, and immutable execution records — once a maintenance task is recorded as done, that record does not change.',
      'I led the schema and API contract design and coordinated it across the frontend, backend, and DBA teams. Getting the hierarchy right early was what made multi-level editing and revert possible on the client at all.',
    ],
    metrics: [],
    techIds: ['sql', 'rest', 'csharp'],
    size: 'standard',
  },

  // ---------------------------------------------------------------
  // Operator and developer tools (SEL)
  // ---------------------------------------------------------------
  {
    id: 'flying-probe',
    slug: 'flying-probe-dashboard',
    title: 'Flying probe control dashboard',
    clusterId: 'tools',
    ownership: 'contributor',
    ownershipNote: 'Contributor. Primarily frontend.',
    oneLine: 'One place to control and observe every piece of flying probe machine state.',
    body: [
      'A React and Redux dashboard replacing a legacy WPF application, intended as the single interface for running a flying probe tester. Operators queue boards, view full board details including routes and test pass/fail results, and see barcode locations for a given board rendered from the actual image captured off the scanner.',
      'The frontend sends operator input to a backend that speaks to the machine; machine responses travel back the same way and reach the UI by polling. The design goal was a control surface stable enough that one operator running one instance can run the machine end to end.',
      'I worked predominantly on the frontend and the state model.',
    ],
    metrics: [],
    techIds: ['react', 'redux', 'typescript', 'csharp', 'rest'],
    size: 'major',
  },
  {
    id: 'cfx-dev-client',
    slug: 'cfx-developer-client',
    title: 'RabbitMQ / CFX developer client',
    aka: 'RabbitCFXTalker',
    clusterId: 'tools',
    ownership: 'sole',
    ownershipNote: 'Sole developer. Built unprompted, now used by the whole team.',
    oneLine: 'The tool the team needed for years, built in the gaps.',
    body: [
      'Before this existed the team had no practical way to talk to RabbitMQ while developing. Testing a driver meant contriving a real message from a real machine. Everyone needed it; nobody had built it.',
      'It connects to any number of hosts, exchanges, and topics at once, listening and publishing across all of them. Its more useful half composes complete IPC-CFX messages from minimal input — supply two unit identifiers and it packages the remaining fields, so a developer can send a valid message without hand-writing the envelope.',
      'This is the developer counterpart to the operator monitoring console: same message bus, opposite audience. Built on my own initiative and now used by all four engineers on the team.',
    ],
    metrics: [
      { value: '4 of 4', label: 'engineers on the team using it' },
    ],
    techIds: ['csharp', 'rabbitmq', 'ipc-cfx'],
    size: 'standard',
  },
  {
    id: 'operator-console',
    slug: 'operator-monitoring-console',
    title: 'Operator monitoring console',
    aka: 'Beholder',
    clusterId: 'tools',
    ownership: 'contributor',
    ownershipNote: 'Contributor. Built while mentoring a junior developer through their first production service.',
    oneLine: 'Live message monitoring for the floor, with a deliberately narrow command surface.',
    body: [
      'A Blazor application listening to RabbitMQ with live filtering across 5k+ events, giving operators visibility into what the automation services are actually doing.',
      'It can do two things beyond observing: enter a board scan manually, and restart a driver. That surface is narrow by design — the drivers do not depend on the console to run, so if it is down, production is not.',
      'I built this alongside a junior developer, working through their first production service with them.',
    ],
    metrics: [
      { value: '5k+', label: 'events filtered live' },
    ],
    techIds: ['blazor', 'csharp', 'rabbitmq'],
    size: 'standard',
  },

  // ---------------------------------------------------------------
  // METER Group (internship)
  // ---------------------------------------------------------------
  {
    id: 'meter-zentra',
    slug: 'zentra-web-platform',
    title: 'ZENTRA web platform',
    clusterId: 'meter',
    ownership: 'contributor',
    ownershipNote: 'Contributor. Frontend components and pages.',
    oneLine: 'Subscription purchasing and components for an environmental monitoring platform.',
    body: [
      'ZENTRA is the web platform for METER Group\'s environmental sensor hardware. I built React and MUI components and pages across the site, with most of my work on the subscription purchasing flow — the path effectively every hardware customer passes through.',
      'Separately, I handled reporting requests from the sales team, writing Django queries across 150k+ object relationships to pull usage statistics that had no existing reporting path.',
    ],
    metrics: [
      { value: '150k+', label: 'objects queried for sales reporting' },
    ],
    techIds: ['react', 'typescript', 'python', 'django'],
    size: 'standard',
  },
  {
    id: 'meter-pipeline',
    slug: 'soil-moisture-pipeline',
    title: 'Soil moisture prediction pipeline',
    clusterId: 'meter',
    ownership: 'sole',
    ownershipNote: 'Sole developer.',
    oneLine: 'Serverless pipeline predicting soil moisture so growers could water proactively.',
    body: [
      'A Python pipeline on AWS Lambda and DynamoDB, deployed with the Serverless Framework, ingesting soil sensor readings, location, and weather data to forecast soil moisture ahead of time. The goal was to let growers plan irrigation against a prediction instead of reacting to a reading that had already dropped.',
      'The pipeline was built and working. The feature was cut before launch and never shipped.',
    ],
    metrics: [],
    techIds: ['python', 'lambda', 'dynamodb'],
    size: 'standard',
  },

  // ---------------------------------------------------------------
  // Client work
  // ---------------------------------------------------------------
  {
    id: 'sonder-barber',
    slug: 'sonder-barber',
    title: 'Sonder Barber',
    clusterId: 'client',
    ownership: 'sole',
    ownershipNote: 'Sole developer. Built for the client at no charge.',
    oneLine: 'Marketing site for a Pullman barbershop, built free for a local business.',
    body: [
      'A local barbershop wanted a site that felt as considered as the shop does, both to show existing clients and to bring new ones in. Next.js 15 and React 19, with scroll-snap sections, custom reveal animations, a paginated barber roster, hours and location, and direct booking links.',
      'Built and shipped free. It is live and in use.',
    ],
    metrics: [],
    techIds: ['nextjs', 'react', 'typescript', 'tailwind'],
    links: [{ label: 'sonderbarbers.com', href: 'https://sonderbarbers.com' }],
    size: 'standard',
  },

  // ---------------------------------------------------------------
  // Personal
  // ---------------------------------------------------------------
  {
    id: 'vgclite',
    slug: 'vgclite',
    title: 'VGCLite',
    clusterId: 'personal',
    ownership: 'sole',
    ownershipNote: 'Sole developer.',
    oneLine: 'Competitive Pokémon team analysis, with four independent caching layers.',
    body: [
      'VGCLite pulls competitive usage data from Smogon and Pikalytics and turns it into something a player can actually build a team against. The interesting part is not the interface — it is that both upstream sources are slow, large, and update on their own schedules, and the site has to stay fast anyway.',
      'There are four caching layers. Server-side, format discovery and Pikalytics builds go through Next\'s unstable_cache with explicit windows — one hour for discovery, three hours for builds, kept short because Pikalytics updates often. This survives serverless cold starts, so a Lambda waking up does not re-fetch and re-parse everything. Smogon\'s raw chaos JSON exceeds unstable_cache\'s 2MB limit, so it uses Next\'s fetch cache instead at six hours; PokeAPI species data sits at twenty-four, being near-static. Learnsets never change at runtime, so those live in a plain in-memory Map with no expiry at all.',
      'Above that, the bootstrap endpoint sets a CDN policy of thirty minutes fresh with stale-while-revalidate up to a day, so the edge absorbs most traffic.',
      'On the client, a ref-held Map is the single source of truth for every Pokémon fetched. It checks four states before making a request: fully loaded, currently loading, partially loaded, or absent. A concurrent request for a Pokémon already in flight gets the existing placeholder rather than firing a duplicate. Switching format invalidates only the usage builds in place, so sprites, stats, and types survive the switch and only what actually changed is re-fetched. A second module-level cache does the same for movepools, so reopening the build editor for a species costs nothing.',
      'Mega formes needed a different answer. Neither source tracks them as separate entries, so the app tries a direct fetch, falls back to the base species with the item and ability force-overridden, and flags the result as approximated so the interface can label it honestly rather than presenting a guess as data.',
    ],
    metrics: [
      { value: '4', label: 'independent caching layers', note: 'server, CDN, client, module' },
      { value: '~1k', label: 'peak weekly visitors' },
    ],
    techIds: ['nextjs', 'react', 'typescript', 'tailwind'],
    links: [{ label: 'vgclite.com', href: 'https://vgclite.com' }],
    size: 'major',
  },
  {
    id: 'pokemon-team-builder',
    slug: 'pokemon-team-builder',
    title: 'Pokémon Team Builder',
    clusterId: 'personal',
    ownership: 'sole',
    ownershipNote: 'Sole developer.',
    oneLine: 'Real-time type coverage analysis across every mainline game\'s ruleset.',
    body: [
      'Pick a game, pick up to six Pokémon, and see the team\'s type matchups analysed live. The complication is that type effectiveness is not one chart — rules changed between generations, so each game needs its own.',
      'Rather than store a multiplier matrix per generation, effectiveness is precomputed into immune, resist, and weak sets per type, which makes generation-specific rule changes a data problem instead of a branching problem. Per Pokémon, the one or two types are combined with immunity overriding resistance overriding weakness. Across the team, the app tallies how many members are weak, resistant, or immune to each attacking type into a net coverage score, colour-coded so gaps and redundancies are visible at a glance.',
    ],
    metrics: [],
    techIds: ['nextjs', 'react', 'typescript'],
    links: [
      { label: 'peterptb.vercel.app', href: 'https://peterptb.vercel.app/' },
      { label: 'GitHub', href: 'https://github.com/peter-t-wang315/pokemonteambuilder' },
    ],
    size: 'standard',
  },
  {
    id: 'timesense',
    slug: 'timesense',
    title: 'TimeSense',
    clusterId: 'personal',
    ownership: 'contributor',
    ownershipNote: 'Co-creator. Built the Rust process layer, SQLite storage, and data model. Team of two.',
    oneLine: 'Desktop time tracker that won the advanced track at WSU CrimsonCode 2024.',
    body: [
      'A Tauri desktop app that tracks where your time actually goes. A Rust process polls the focused application every five seconds and logs it to SQLite; the frontend surfaces that as a pie chart and a calendar of what you did. Per-app time budgets fire desktop notifications when you go over, and a ChatGPT integration lets you ask questions about your own data.',
      'I built the Rust side — process polling, the SQLite layer, and shaping the data for my teammate to render — then took on the calendar view and other frontend pieces.',
      'Built in 24 hours by a team of two. Won the advanced track at WSU CrimsonCode 2024.',
    ],
    metrics: [
      { value: '1st', label: 'advanced track, WSU CrimsonCode 2024' },
      { value: '24 hrs', label: 'build time', note: 'team of two' },
    ],
    techIds: ['rust', 'nextjs', 'typescript', 'sql', 'tailwind'],
    links: [{ label: 'GitHub', href: 'https://github.com/peter-t-wang315/TimeSense' }],
    size: 'standard',
  },
  {
    id: 'code-quiz-2023',
    slug: 'coding-quiz-platform',
    title: 'Coding quiz platform',
    clusterId: 'personal',
    ownership: 'contributor',
    ownershipNote: 'Contributor. Frontend components. Team of four.',
    oneLine: 'Gamified language-learning platform on an Elixir API. Third place, WSU Hackathon 2023.',
    body: [
      'A Duolingo-shaped app for programming languages. Users work through coding questions across Python, JavaScript, TypeScript, and C#, tracking completion by category and earning badges.',
      'React and TypeScript on Vite with Tailwind and React Router on the frontend, three custom question-type components for multiple choice, fill-in, and code snippets. The API is a custom Elixir server on Plug and Cowboy talking to Postgres through Ecto, with badge eligibility calculated server-side and Postgres triggers auto-provisioning user rows on signup. Auth and database hosting via Supabase.',
      'I built frontend components. Team of four, 24 hours, third place.',
    ],
    metrics: [
      { value: '3rd', label: 'WSU Hackathon 2023', note: 'team of four, 24 hours' },
    ],
    techIds: ['react', 'typescript', 'tailwind', 'sql'],
    size: 'standard',
  },
  {
    id: 'thai-ginger',
    slug: 'thai-ginger',
    title: 'Thai Ginger',
    clusterId: 'personal',
    ownership: 'sole',
    ownershipNote: 'Sole developer.',
    oneLine: 'Restaurant site with a Claude-powered menu parser that turns photos into structured data.',
    body: [
      'A site for a Pullman restaurant — landing page, about page, and a dynamic menu backed by Supabase. Next.js 15 and React 19, Tailwind, GSAP for scroll-triggered transitions.',
      'The part worth talking about is the admin tool. Keeping a restaurant menu current is the reason restaurant sites go stale, so an administrator uploads a photograph of the physical menu and the Anthropic API extracts categories, items, descriptions, and prices into structured records. The update path becomes taking a picture.',
      'Built independently. It is live and receives regular traffic.',
    ],
    metrics: [],
    techIds: ['nextjs', 'react', 'typescript', 'tailwind', 'sql'],
    links: [{ label: 'thaigingerpullman.com', href: 'https://thaigingerpullman.com' }],
    size: 'standard',
  },
  {
    id: 'this-site',
    slug: 'this-site',
    title: 'This site',
    clusterId: 'personal',
    ownership: 'sole',
    ownershipNote: 'Sole developer.',
    oneLine: 'A portfolio rendered as the thing it describes — a connected service topology.',
    body: [
      'Most of my work is message routing between services, so this site is built as a node graph. That choice is not decorative: the edges in the SEL clusters are real runtime message paths between services I worked on, not "these two share a technology." Solid animated edges mean messages actually move along them. Faint static edges mean shared tooling. The distinction is the point.',
      'Next.js App Router with React Three Fiber. The canvas lives in the root layout rather than in a page, so it persists across route changes and the camera flight from the landing page into the graph is continuous rather than a page transition. Layout positions are computed once at build from a seeded generator, so the constellation is identical on every load.',
      'Every project exists as a real, crawlable, keyboard-navigable page at /work/[slug], rendered from the same content object the 3D node displays. The graph is a second way through the same material, never the only one. With WebGL unavailable the site is completely usable.',
      'Built with Claude Code.',
    ],
    metrics: [],
    techIds: ['nextjs', 'react', 'typescript', 'tailwind'],
    size: 'standard',
  },
];
