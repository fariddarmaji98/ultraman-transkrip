// Label kecil huruf-besar di atas tiap blok sidebar.
// `data-test` wajib dari pemanggil: label ini bisa muncul beberapa kali dalam
// satu layar (mis. tiga panel di tab Unduhan), dan nilai default akan membuat
// ketiganya tak bisa dibedakan saat diuji.
export default function SectionLabel({ children, ...rest }) {
  return (
    <div {...rest} className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-fg3">
      {children}
    </div>
  )
}
