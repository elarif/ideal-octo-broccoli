export interface WpPost {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media: number;
  date_gmt: string;
  modified_gmt: string;
  auteur: number[];
  voix: number[];
  genre_livre: number[];
  periode: number[];
  region: number[];
  licence: number[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url: string;
      alt_text: string;
      media_details: { width: number; height: number };
    }>;
    "wp:term"?: Array<Array<{ id: number; slug: string; name: string; taxonomy: string }>>;
  };
}

export interface WpMedia {
  id: number;
  slug: string;
  title: { rendered: string };
  mime_type: string;
  source_url: string;
  media_details?: { filesize?: number; length?: number; menu_order?: number };
}

export interface WpTerm {
  id: number;
  slug: string;
  name: string;
  description: string;
  count: number;
}
