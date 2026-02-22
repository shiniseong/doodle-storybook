export interface StorybookDetailSummary {
  storybookId: string
  title: string
  authorName: string | null
  description: string
  originImageUrl: string | null
  createdAt: string | null
}

export interface StorybookOriginDetail {
  pageIndex: number
  drawingImageUrl: string | null
  description: string
}

export interface StorybookOutputDetail {
  pageIndex: number
  pageType: 'cover' | 'story'
  title: string | null
  content: string | null
  imageUrl: string | null
  audioUrl: string | null
  isHighlight: boolean
}

export interface StorybookEbookPage {
  page: number
  content: string
  isHighlight: boolean
}

export interface StorybookEbookNarration {
  page: number
  audioDataUrl: string
}

export interface StorybookEbook {
  title: string
  authorName: string | null
  coverImageUrl: string | null
  highlightImageUrl: string | null
  finalImageUrl: string | null
  pages: StorybookEbookPage[]
  narrations: StorybookEbookNarration[]
}

export interface StorybookDetailResponse {
  storybookId: string
  storybook: StorybookDetailSummary
  details: {
    origin: StorybookOriginDetail[]
    output: StorybookOutputDetail[]
  }
  ebook: StorybookEbook
}
