'use client'
import { useFormStatus } from 'react-dom'
import { setPostStatus } from '@/app/actions/posts'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn btn-danger-outline btn-pill" disabled={pending}>
      {pending ? 'กำลังลบ…' : 'ลบประกาศนี้'}
    </button>
  )
}

/** "ลบประกาศ" on the edit pages — asks first, then deletes and returns to the list. */
export default function DeletePostButton({ type, id, next = '/teams' }: { type: 'team' | 'seeker' | 'cofounder'; id: string; next?: string }) {
  return (
    <form
      action={setPostStatus}
      className="danger-zone"
      onSubmit={(e) => {
        if (!confirm('ลบประกาศนี้ถาวร? การลบไม่สามารถย้อนกลับได้')) e.preventDefault()
      }}
    >
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value="delete" />
      <input type="hidden" name="next" value={next} />
      <span className="txt">
        <b>ลบประกาศ</b>
        <span>ประกาศจะหายจากเว็บทันที และไม่สามารถกู้คืนได้</span>
      </span>
      <Submit />
    </form>
  )
}
