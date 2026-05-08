import { Badge, Flex } from '@strapi/design-system';
import type { LocaleInfo, LocaleStatus } from '../types';

interface LocaleBadgesProps {
  locales: LocaleInfo[];
}

const statusColors: Record<LocaleStatus, { textColor: string; backgroundColor: string }> = {
  draft: { textColor: 'success700', backgroundColor: 'success100' },
  published: { textColor: 'primary700', backgroundColor: 'primary100' },
  missing: { textColor: 'warning700', backgroundColor: 'warning100' },
};

const statusSuffix: Record<LocaleStatus, string> = {
  draft: '',
  published: ' \u2713',
  missing: ' \u2717',
};

const LocaleBadges = ({ locales }: LocaleBadgesProps) => {
  return (
    <Flex gap={1} wrap="wrap">
      {locales.map(({ locale, status }) => {
        const colors = statusColors[status];
        return (
          <Badge
            key={locale}
            textColor={colors.textColor}
            backgroundColor={colors.backgroundColor}
            size="S"
          >
            {locale}
            {statusSuffix[status]}
          </Badge>
        );
      })}
    </Flex>
  );
};

export default LocaleBadges;
