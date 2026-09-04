// Shape + defaults of the public website's editable content.
//
// Everything a visitor reads (copy, prices/passes, opening hours, contact
// details, images) lives in one SiteContent document. Admins edit it under
// Admin → Website; the API stores it and the site merges what's stored on
// top of these defaults, so a field that was never edited still shows the
// original wording.

export type SitePass = { label: string; price: string; note?: string };

export type SiteService = {
  title: string;
  tagline: string;
  image: string;
  featured?: boolean;
  passes: SitePass[];
};

export type SiteEventItem = {
  id: string;
  title: string;
  category: string;
  /** Short weekday shown in the date chip ("Mon"). */
  day: string;
  /** Day of month shown in the date chip ("—" when the event has no date yet). */
  date: number | string;
  time: string;
  spots: string;
  /** Present for real (published) events — links to the registration page. */
  href?: string;
  price?: string;
  location?: string | null;
};

export type SiteContent = {
  announcement: { active: boolean; text: string; bgColor: string; textColor: string };
  home: {
    hero: {
      eyebrow: string;
      title: string;
      description: string;
      image: string;
      primaryLabel: string;
      primaryHref: string;
      secondaryLabel: string;
      secondaryHref: string;
      stats: { value: string; label: string }[];
    };
    overview: { eyebrow: string; title: string; paragraphs: string[] };
    gallery: { eyebrow: string; title: string; description: string; items: { image: string; caption: string }[] };
    tags: string[];
    cta: {
      title: string;
      description: string;
      primaryLabel: string;
      primaryHref: string;
      secondaryLabel: string;
      secondaryHref: string;
    };
  };
  menu: { eyebrow: string; title: string; highlight: string; description: string; note: string; image: string };
  services: {
    eyebrow: string;
    title: string;
    description: string;
    items: SiteService[];
    ctaTitle: string;
    ctaDescription: string;
    ctaButtonLabel: string;
    ctaButtonHref: string;
  };
  events: {
    hero: {
      eyebrow: string;
      title: string;
      highlight: string;
      description: string;
      image: string;
      secondaryLabel: string;
      secondaryHref: string;
      joinLabel: string;
    };
    listing: { eyebrow: string; title: string; emptyState: string };
    cta: { title: string; description: string; buttonLabel: string; buttonHref: string };
  };
  contact: {
    eyebrow: string;
    title: string;
    highlight: string;
    description: string;
    formTitle: string;
    formDescription: string;
    phone: string;
    email: string;
    whatsapp: string;
    instagram: string;
    address: string;
    addressLong: string;
    mapEmbed: string;
    hours: { day: string; time: string }[];
  };
  footer: { blurb: string; tagline: string; openNote: string };
};

export const IMAGES = {
  home: "/images/site/home.jpeg",
  tcg: "/images/site/tcg.jpeg",
  boardGames: "/images/site/board-games.jpeg",
  ps5: "/images/site/ps5.jpeg",
  branding: "/images/site/axis-branding-transparent.png",
  xMark: "/images/site/x-mark-brand.png",
  placeholder: "/images/image-placeholder.svg",
} as const;

export const NAV_LINKS = [
  { id: "nav-home", label: "Home", href: "/" },
  { id: "nav-menu", label: "Menu", href: "/menu" },
  { id: "nav-services", label: "Services", href: "/services" },
  { id: "nav-events", label: "Events", href: "/events" },
  { id: "nav-contact", label: "Contact", href: "/contact" },
];

/** Sample schedule, shown only when the events API cannot be reached. */
export const FALLBACK_EVENTS: SiteEventItem[] = [
  { id: "1", title: "Yu-Gi-Oh! Weekly Locals", category: "TCG", day: "Mon", date: 6, time: "6:00 PM", spots: "16 seats" },
  { id: "2", title: "Magic: Commander Night", category: "TCG", day: "Tue", date: 7, time: "6:30 PM", spots: "Open table" },
  { id: "3", title: "Pokémon League", category: "TCG", day: "Wed", date: 8, time: "5:00 PM", spots: "All ages" },
  { id: "4", title: "FIFA / EA FC Tournament", category: "PlayStation", day: "Wed", date: 8, time: "7:00 PM", spots: "8 players" },
  { id: "5", title: "Dungeons & Dragons Session", category: "Board Games", day: "Thu", date: 9, time: "6:00 PM", spots: "6 seats" },
  { id: "6", title: "Anime Trivia Night", category: "Community", day: "Thu", date: 9, time: "8:00 PM", spots: "Walk-in" },
  { id: "7", title: "One Piece Card Game Locals", category: "TCG", day: "Fri", date: 10, time: "6:00 PM", spots: "16 seats" },
  { id: "8", title: "Paint & Play Workshop", category: "Workshop", day: "Sat", date: 11, time: "2:00 PM", spots: "10 seats" },
  { id: "9", title: "Board Game Meetup", category: "Board Games", day: "Sat", date: 11, time: "4:00 PM", spots: "Open" },
  { id: "10", title: "Tekken 8 Showdown", category: "PlayStation", day: "Sat", date: 11, time: "7:00 PM", spots: "16 players" },
  { id: "11", title: "Community Game Day", category: "Community", day: "Sun", date: 12, time: "1:00 PM", spots: "Walk-in" },
  { id: "12", title: "Lorcana Prerelease", category: "TCG", day: "Sun", date: 12, time: "3:00 PM", spots: "24 seats" },
];

export const DEFAULT_SITE_CONTENT: SiteContent = {
  announcement: {
    active: true,
    text: "Welcome to AXIS — your ultimate gaming hub!",
    bgColor: "#87b2dd",
    textColor: "#071018",
  },
  home: {
    hero: {
      eyebrow: "Where everything connects",
      title: "Eat. Drink. Play.",
      description:
        "The home for trading cards, board games, PlayStation 5 and great food. One place where everything connects.",
      image: IMAGES.home,
      primaryLabel: "Explore the Menu",
      primaryHref: "/menu",
      secondaryLabel: "View Passes & Pricing",
      secondaryHref: "/services",
      stats: [
        { value: "5+", label: "Ways to play" },
        { value: "PS5", label: "Next-gen stations" },
        { value: "8", label: "TCG universes" },
      ],
    },
    overview: {
      eyebrow: "Overview",
      title: "Where gaming, community, and passion connect together",
      paragraphs: [
        "AXIS is a modern entertainment hub designed to bring people together through gaming, great food, and shared experiences. By combining a premium trading card store, dedicated gaming spaces, PlayStation 5 stations, a billiard table, and a full-service café, AXIS offers something for everyone — whether you're here to compete, relax, or simply spend quality time with friends and family.",
        "Explore the latest products from the world's leading trading card games, discover new board games, enjoy a friendly game of billiards, or challenge your friends on PlayStation 5. When it's time to take a break, our café serves a carefully crafted menu featuring quality cuisine, specialty drinks, and special desserts, making AXIS the perfect place to spend an afternoon or an entire day.",
        "Throughout the year we host tournaments, prereleases, community events, and special gatherings that welcome players and visitors of all backgrounds — a welcoming atmosphere where everyone can connect, create memories, and enjoy everything under one roof.",
      ],
    },
    gallery: {
      eyebrow: "Step inside",
      title: "The space, lit just right",
      description:
        "Moody but vibrant — deep shadows with sharp pops of neon. This is where everything connects.",
      items: [
        { image: IMAGES.home, caption: "The AXIS storefront" },
        { image: IMAGES.tcg, caption: "TCG floor & card display" },
        { image: IMAGES.boardGames, caption: "Board games area" },
        { image: IMAGES.ps5, caption: "PlayStation 5 lounge" },
      ],
    },
    tags: ["Board Games", "PlayStation 5", "Community Events", "Trading Cards", "Café", "Billiards"],
    cta: {
      title: "Play. Dine. Compete. Connect.",
      description: "Welcome to AXIS — the perfect place to spend an afternoon or an entire day.",
      primaryLabel: "Browse the Café",
      primaryHref: "/menu",
      secondaryLabel: "See Upcoming Events",
      secondaryHref: "/events",
    },
  },
  menu: {
    eyebrow: "Eat & drink at AXIS",
    title: "Game night meets",
    highlight: "great food & drink",
    description:
      "Whether you're here for an intense tournament, a casual game night, or simply to relax with friends, AXIS offers the perfect atmosphere to eat, play, and connect. Our café serves a carefully crafted menu of quality dishes, handcrafted drinks, and indulgent desserts — making every visit as enjoyable off the table as it is on it.",
    note: "Fuel up before the next round — no one wins on an empty tank!",
    image: IMAGES.home,
  },
  services: {
    eyebrow: "Our services",
    title: "Pick your play",
    description:
      "Passes and pricing for board games, PlayStation 5, darts, billiards, trading card games, and birthday bundles. Walk in any day — no reservation needed.",
    items: [
      {
        title: "Board Games",
        tagline: "Hundreds of titles to play in-house — grab a table and dive in.",
        image: IMAGES.boardGames,
        passes: [
          { label: "Hour pass", price: "3$" },
          { label: "Day pass", price: "6$" },
          { label: "Monthly pass", price: "80$" },
        ],
      },
      {
        title: "PlayStation 5",
        tagline: "Next-gen stations with the latest titles, ready to play.",
        image: IMAGES.ps5,
        passes: [{ label: "Game session", price: "3$", note: "1 hr / person" }],
      },
      {
        title: "Darts",
        tagline: "Test your aim solo or challenge your friends.",
        image: IMAGES.placeholder,
        passes: [{ label: "Hour game", price: "5$", note: "per person" }],
      },
      {
        title: "Billiard",
        tagline: "Rack 'em up on our billiard table.",
        image: IMAGES.placeholder,
        passes: [{ label: "Game", price: "3$" }],
      },
      {
        title: "Trading Card Games",
        tagline: "Play, trade, and compete across all your favorite TCGs.",
        image: IMAGES.tcg,
        passes: [{ label: "Open play", price: "Free", note: "free of charge" }],
      },
      {
        title: "Birthday Bundle",
        tagline: "The full AXIS experience — board games, food, and PS5.",
        image: IMAGES.placeholder,
        featured: true,
        passes: [{ label: "Per kid", price: "25$", note: "board games / food / PS5" }],
      },
    ],
    ctaTitle: "Hungry while you play?",
    ctaDescription: "Pair any pass with something from our full-service café.",
    ctaButtonLabel: "Explore the Menu",
    ctaButtonHref: "/menu",
  },
  events: {
    hero: {
      eyebrow: "What's on",
      title: "Events &",
      highlight: "tournaments",
      description:
        "Looking for your next adventure? AXIS hosts an exciting lineup of events throughout the year — from competitive Trading Card Game tournaments and PlayStation 5 competitions to anime trivia nights, creative workshops, board game gatherings, and community celebrations. Whether you're competing for the top spot, learning something new, or simply looking for a fun evening with friends, there's always something happening at AXIS.",
      image: IMAGES.tcg,
      secondaryLabel: "View Services",
      secondaryHref: "/services",
      joinLabel: "Join an Event",
    },
    listing: {
      eyebrow: "This week",
      title: "What's coming up",
      emptyState: "No events in this category right now — check back soon.",
    },
    cta: {
      title: "Want to host or compete?",
      description: "Reach out to reserve a seat, register a team, or plan your own event at AXIS.",
      buttonLabel: "Contact Us",
      buttonHref: "/contact",
    },
  },
  contact: {
    eyebrow: "We'd love to hear from you",
    title: "Get in",
    highlight: "Touch",
    description: "Questions, bookings, events, or just want to say hi — reach out and we'll respond within hours.",
    formTitle: "Send us a message",
    formDescription: "Fill in the form and we'll get back to you.",
    phone: "78 729 282",
    email: "axis.tcg.connect@gmail.com",
    whatsapp: "+961 78 729 282",
    instagram: "https://instagram.com/axis_lb",
    address: "Street 60, Achrafieh, Beirut",
    addressLong: "Street 60, Achrafieh — Near Sassine Square, Beirut",
    mapEmbed:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2766.379548707605!2d35.51889692458251!3d33.88625567834171!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151f17490245079d%3A0x3179f6e9370dd640!2sAXIS%20Local%20Gaming%20Hub!5e0!3m2!1sen!2slb!4v1783438075602!5m2!1sen!2slb",
    hours: [
      { day: "Mon - Thu", time: "12 pm - 10 pm" },
      { day: "Fri - Sat", time: "10 am - 12 am" },
      { day: "Sunday", time: "11 am - 9 pm" },
    ],
  },
  footer: {
    blurb:
      "Play. Dine. Compete. Connect. AXIS is a modern entertainment hub bringing people together through gaming, great food, and shared experiences — all under one roof.",
    tagline: "Where everything connects",
    openNote: "Open daily · Walk-ins welcome",
  },
};
