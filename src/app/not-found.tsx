import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 text-6xl font-bold text-neutral-300">404</h1>
        <h2 className="mb-2 text-2xl font-bold">找不到頁面</h2>
        <p className="mb-4 text-neutral-500">您要找的頁面不存在或已被移除</p>
        <Link
          href="/"
          className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          返回首頁
        </Link>
      </div>
    </div>
  );
}
