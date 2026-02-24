import {defineField, defineType} from 'sanity'

export const popupType = defineType({
  name: 'pop-ups',
  title: 'Pop-ups',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      description: 'Pop-up event title shown on listings.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      description: 'URL-friendly identifier for the pop-up event.',
      options: {source: 'name'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'start_datetime',
      type: 'datetime',
      hidden: ({document}) => Boolean(document?.all_day),
      validation: (rule) =>
        rule.custom((value, context) => {
          if (context.document?.all_day) return true;
          return value ? true : 'Start date/time is required for timed events.';
        }),
    }),
    defineField({
      name: 'end_datetime',
      type: 'datetime',
      hidden: ({document}) => Boolean(document?.all_day),
      validation: (rule) =>
        rule.custom((value, context) => {
          if (context.document?.all_day) return true;
          const start = context.document?.start_datetime
            ? new Date(String(context.document.start_datetime))
            : null;
          const end = value ? new Date(String(value)) : null;
          if (start && end && end < start) {
            return 'End date/time must be after the start date/time.';
          }
          return true;
        }),
    }),
    defineField({
      name: 'start_date',
      type: 'date',
      description: 'Use for all-day events (no time).',
      hidden: ({document}) => !document?.all_day,
      validation: (rule) =>
        rule.custom((value, context) => {
          if (!context.document?.all_day) return true;
          return value ? true : 'Start date is required for all-day events.';
        }),
    }),
    defineField({
      name: 'end_date',
      type: 'date',
      description: 'Use for all-day multi-day events.',
      hidden: ({document}) => !document?.all_day,
      validation: (rule) =>
        rule.custom((value, context) => {
          if (!context.document?.all_day) return true;
          const start = context.document?.start_date
            ? new Date(String(context.document.start_date))
            : null;
          const end = value ? new Date(String(value)) : null;
          if (start && end && end < start) {
            return 'End date must be on or after the start date.';
          }
          return true;
        }),
    }),
    defineField({
      name: 'all_day',
      type: 'boolean',
      description: 'Enable for events that run all day with no specific time.',
      initialValue: false,
    }),
    defineField({
      name: 'recurring',
      type: 'boolean',
      description: 'Enable if this event repeats on a schedule.',
      initialValue: false,
    }),
    defineField({
      name: 'recurrence_frequency',
      type: 'string',
      description: 'How often the event repeats.',
      options: {
        list: [
          {title: 'Daily', value: 'daily'},
          {title: 'Weekly', value: 'weekly'},
          {title: 'Monthly', value: 'monthly'},
        ],
        layout: 'radio',
      },
      hidden: ({document}) => !document?.recurring,
      validation: (rule) =>
        rule.custom((value, context) => {
          if (!context.document?.recurring) return true;
          return value ? true : 'Frequency is required for recurring events.';
        }),
    }),
    defineField({
      name: 'recurrence_interval',
      type: 'number',
      description: 'Repeat every N units (e.g., every 2 weeks).',
      initialValue: 1,
      hidden: ({document}) => !document?.recurring,
      validation: (rule) =>
        rule.custom((value, context) => {
          if (!context.document?.recurring) return true;
          if (typeof value !== 'number' || value < 1) {
            return 'Interval must be 1 or greater.';
          }
          return true;
        }),
    }),
    defineField({
      name: 'recurrence_by_weekday',
      type: 'array',
      description: 'Days of the week the event repeats on.',
      of: [{type: 'string'}],
      options: {
        list: [
          {title: 'Sunday', value: 'SU'},
          {title: 'Monday', value: 'MO'},
          {title: 'Tuesday', value: 'TU'},
          {title: 'Wednesday', value: 'WE'},
          {title: 'Thursday', value: 'TH'},
          {title: 'Friday', value: 'FR'},
          {title: 'Saturday', value: 'SA'},
        ],
      },
      hidden: ({document}) =>
        !document?.recurring || document?.recurrence_frequency !== 'weekly',
      validation: (rule) =>
        rule.custom((value, context) => {
          if (!context.document?.recurring) return true;
          if (context.document?.recurrence_frequency !== 'weekly') return true;
          return value && value.length > 0
            ? true
            : 'Select at least one weekday for weekly recurrence.';
        }),
    }),
    defineField({
      name: 'recurrence_monthly_mode',
      type: 'string',
      description: 'Choose how monthly recurrence is defined.',
      options: {
        list: [
          {title: 'By month day (e.g., 1st, 15th)', value: 'monthday'},
          {title: 'By weekday position (e.g., 1st Friday)', value: 'weekday'},
        ],
        layout: 'radio',
      },
      hidden: ({document}) => !document?.recurring || document?.recurrence_frequency !== 'monthly',
      validation: (rule) =>
        rule.custom((value, context) => {
          if (!context.document?.recurring) return true;
          if (context.document?.recurrence_frequency !== 'monthly') return true;
          return value ? true : 'Choose a monthly recurrence mode.';
        }),
    }),
    defineField({
      name: 'recurrence_by_monthday',
      type: 'array',
      description: 'Month days for monthly recurrence (e.g., 1, 15, 30).',
      of: [{type: 'number'}],
      hidden: ({document}) =>
        !document?.recurring ||
        document?.recurrence_frequency !== 'monthly' ||
        document?.recurrence_monthly_mode === 'weekday',
      validation: (rule) =>
        rule.custom((value, context) => {
          if (!context.document?.recurring) return true;
          if (context.document?.recurrence_frequency !== 'monthly') return true;
          if (context.document?.recurrence_monthly_mode === 'weekday') return true;
          if (!value || value.length === 0) {
            return 'Select at least one month day for monthly recurrence.';
          }
          const invalid = value.some((day: number) => day < 1 || day > 31);
          return invalid ? 'Month days must be between 1 and 31.' : true;
        }),
    }),
    defineField({
      name: 'recurrence_by_weekday_ordinal',
      type: 'string',
      description: 'Which occurrence of the weekday in the month (e.g., first Friday).',
      options: {
        list: [
          {title: 'First', value: '1'},
          {title: 'Second', value: '2'},
          {title: 'Third', value: '3'},
          {title: 'Fourth', value: '4'},
          {title: 'Last', value: '-1'},
        ],
        layout: 'radio',
      },
      hidden: ({document}) =>
        !document?.recurring ||
        document?.recurrence_frequency !== 'monthly' ||
        document?.recurrence_monthly_mode !== 'weekday',
      validation: (rule) =>
        rule.custom((value, context) => {
          if (!context.document?.recurring) return true;
          if (context.document?.recurrence_frequency !== 'monthly') return true;
          if (context.document?.recurrence_monthly_mode !== 'weekday') return true;
          return value ? true : 'Choose which weekday occurrence (e.g., first, last).';
        }),
    }),
    defineField({
      name: 'recurrence_by_monthly_weekday',
      type: 'string',
      description: 'Weekday for monthly recurrence (e.g., Friday).',
      options: {
        list: [
          {title: 'Sunday', value: 'SU'},
          {title: 'Monday', value: 'MO'},
          {title: 'Tuesday', value: 'TU'},
          {title: 'Wednesday', value: 'WE'},
          {title: 'Thursday', value: 'TH'},
          {title: 'Friday', value: 'FR'},
          {title: 'Saturday', value: 'SA'},
        ],
        layout: 'radio',
      },
      hidden: ({document}) =>
        !document?.recurring ||
        document?.recurrence_frequency !== 'monthly' ||
        document?.recurrence_monthly_mode !== 'weekday',
      validation: (rule) =>
        rule.custom((value, context) => {
          if (!context.document?.recurring) return true;
          if (context.document?.recurrence_frequency !== 'monthly') return true;
          if (context.document?.recurrence_monthly_mode !== 'weekday') return true;
          return value ? true : 'Choose a weekday for monthly recurrence.';
        }),
    }),
    defineField({
      name: 'recurrence_end_date',
      type: 'date',
      description: 'Optional end date for the recurrence schedule.',
      hidden: ({document}) => !document?.recurring,
    }),
    defineField({
      name: 'location',
      type: 'string',
    }),
    defineField({
      name: 'link',
      type: 'url',
    }),
    defineField({
      name: 'link_text',
      type: 'string',
    }),
    defineField({
      name: 'short_description',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'long_description',
      type: 'text',
      rows: 6,
    }),
    defineField({
      name: 'image',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({
      name: 'display_overall',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'display_in_calendar',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'display_in_popups_page',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'display_in_carousel',
      type: 'boolean',
      initialValue: true,
    }),
  ],
})