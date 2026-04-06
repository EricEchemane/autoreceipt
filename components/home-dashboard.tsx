import { getServerOrganizationSession } from "@/lib/auth-organization"
import { listReceipts } from "@/lib/receipt-store"

import { HomeHeroSection } from "@/components/home/home-hero-section"
import { HomeMarketingSections } from "@/components/home/home-marketing-sections"
import { ProcessingWorkspace } from "@/components/home/processing-workspace"
import { RecentReceiptsSection } from "@/components/home/recent-receipts-section"

import { resolveParallelUploads } from "./home/shared"

const MAX_PARALLEL_UPLOADS = resolveParallelUploads()

export async function HomeDashboard() {
  const { organization } = await getServerOrganizationSession()
  const receipts = organization ? await listReceipts(organization.id) : []

  return (
    <main className="relative min-h-svh overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-background" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <HomeHeroSection maxParallelUploads={MAX_PARALLEL_UPLOADS} />
        <ProcessingWorkspace />
        <RecentReceiptsSection
          key={receipts[0]?.id ?? "no-receipts"}
          receipts={receipts}
        />
        <HomeMarketingSections />
      </div>
    </main>
  )
}
