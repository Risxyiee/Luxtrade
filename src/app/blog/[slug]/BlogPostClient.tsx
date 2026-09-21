import BlogPostPage from './BlogPostPageClient'

export default async function BlogPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <BlogPostPage slug={slug} />
}