import { Badge, Flex } from '@strapi/design-system';

interface LocaleInfo {
  locale: string;
  status: 'draft' | 'published' | 'missing';
}

interface LocaleBadgesProps {
  locales: LocaleInfo[];
}

const statusColors: Record<string, { textColor: string; backgroundColor: string }> = {
  draft: { textColor: 'success700', backgroundColor: 'success100' },
  published: { textColor: 'primary700', backgroundColor: 'primary100' },
  missing: { textColor: 'warning700', backgroundColor: 'warning100' },
};

const statusSuffix: Record<string, string> = {
  draft: '',
  published: ' \u2713',
  missing: ' \u2717',
};

const LocaleBadges = ({ locales }: LocaleBadgesProps) => {
  return (
    <Flex gap={1} wrap="wrap">
      {locales.map(({ locale, status }) => {
        const colors = statusColors[status] || statusColors.draft;
        return (
          <Badge
            key={locale}
            textColor={colors.textColor}
            backgroundColor={colors.backgroundColor}
            size="S"
          >
            {locale}
            {statusSuffix[status] || ''}
          </Badge>
        );
      })}
    </Flex>
  );
};

export default LocaleBadges;
