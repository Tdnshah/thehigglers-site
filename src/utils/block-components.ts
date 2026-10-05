import { defineBlockComponents } from "emdash/ui";
import type { PageLayoutBlock } from "../../emdash-env";
import FaqSectionBlock from "../components/blocks/FaqSectionBlock.astro";
import GoalsSectionBlock from "../components/blocks/GoalsSectionBlock.astro";
import HeroSectionBlock from "../components/blocks/HeroSectionBlock.astro";
import LatestWritingBlock from "../components/blocks/LatestWritingBlock.astro";
import LogoWallBlock from "../components/blocks/LogoWallBlock.astro";
import RichTextBlock from "../components/blocks/RichTextBlock.astro";
import TestimonialsSection from "../components/blocks/TestimonialsSection.astro";
import WorkSectionBlock from "../components/blocks/WorkSectionBlock.astro";

/** Page-layout block type -> renderer. Shared by `/` and `/[slug]`. */
export const blockComponents = defineBlockComponents<PageLayoutBlock>({
	hero_section: HeroSectionBlock,
	logo_wall: LogoWallBlock,
	goals_section: GoalsSectionBlock,
	work_section: WorkSectionBlock,
	testimonials_section: TestimonialsSection,
	faq_section: FaqSectionBlock,
	latest_writing: LatestWritingBlock,
	rich_text: RichTextBlock,
});

/** A page whose first block is a hero gets the full-bleed hero + overlay header. */
export const startsWithHero = (layout: readonly { _type: string }[] | null | undefined) =>
	layout?.[0]?._type === "hero_section";
