import BlogPostPage from './page'

export default async function BlogPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <BlogPostPage params={Promise.resolve({ slug })} />
}