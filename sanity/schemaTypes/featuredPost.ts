import {defineField, defineType} from 'sanity'

export const featuredPostType = defineType({
  name: 'featured_post',
  title: 'Featured posts',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      description: 'Title of the featured post.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'embed_url',
      type: 'url',
      description: 'Full embed URL for the post.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'caption',
      type: 'string',
      description: 'Optional label for internal use.',
    }),
    defineField({
      name: 'display_overall',
      type: 'boolean',
      description: 'Show this featured post on the site.',
      initialValue: true,
    }),
  ],
})
