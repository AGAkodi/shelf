import { useEffect, useState } from 'react'
import { useServices } from '../../app/services'
import type { Database } from '../../lib/supabase/database.types'
export type Book = Database['public']['Tables']['books']['Row']
export type Plan = Database['public']['Tables']['borrowing_plans']['Row']
export type CatalogueBook = Book & { borrowing_plans: Plan[] }
export function formatUsdt(units: number | bigint) {
  const amount = BigInt(units)
  const fraction = (amount % 1000000n).toString().padStart(6, '0').replace(/0+$/, '').padEnd(2, '0')
  return `${amount / 1000000n}.${fraction}`
}
export function filterBooks(books: CatalogueBook[], query: string, category: string) {
  const term = query.trim().toLocaleLowerCase()
  return books.filter(book => (!category || book.category === category) && `${book.title} ${book.author} ${book.category}`.toLocaleLowerCase().includes(term))
}
export function useCatalogue() {
  const { supabase } = useServices()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ attempt: number; books: CatalogueBook[]; error: boolean }>()
  useEffect(() => {
    if (!supabase) return
    const controller = new AbortController()
    async function load() {
      const books: CatalogueBook[] = []
      for (let start = 0; ; start += 100) {
        const { data, error } = await supabase!.from('books').select('*, borrowing_plans(*)')
          .eq('status', 'published').retry(false).order('title').order('id').range(start, start + 99).abortSignal(controller.signal)
        if (controller.signal.aborted) return
        if (error) throw error
        books.push(...data.map(book => ({ ...book, borrowing_plans: book.borrowing_plans.filter(plan => plan.enabled).sort((a,b) => a.duration_days - b.duration_days) })))
        if (data.length < 100) break
      }
      if (!controller.signal.aborted) setResult({ attempt, books, error: false })
    }
    void load().catch(() => { if (!controller.signal.aborted) setResult({ attempt, books: [], error: true }) })
    return () => controller.abort()
  }, [supabase, attempt])
  return { books: result?.attempt === attempt ? result.books : [],
    status: !supabase ? 'unconfigured' : result?.attempt !== attempt ? 'loading' : result.error ? 'error' : 'ready',
    retry: () => setAttempt(value => value + 1) }
}
