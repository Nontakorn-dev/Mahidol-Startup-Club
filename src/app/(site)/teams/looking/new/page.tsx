import { redirect } from 'next/navigation'

// Merged into /teams/new (choose "ยังไม่มีทีม ต้องการเข้าร่วมทีม").
export default async function Moved({ searchParams }: PageProps<'/teams/looking/new'>) {
  const sp = await searchParams
  redirect(`/teams/new?as=member${typeof sp.event === 'string' ? `&event=${sp.event}` : ''}`)
}
