import { describe, it, expect } from 'bun:test';
import { personalize } from '../../src/common/template';

describe('Template Personalization (Unit)', () => {
  it('replaces {name} with the provided name', () => {
    expect(personalize('Halo {name}!', 'Budi')).toBe('Halo Budi!');
  });

  it('replaces multiple occurrences of {name}', () => {
    expect(personalize('{name}, pesan penting untuk {name}', 'Siti')).toBe(
      'Siti, pesan penting untuk Siti',
    );
  });

  it('falls back to empty string when name is null', () => {
    expect(personalize('Halo {name}!', null)).toBe('Halo !');
  });

  it('falls back to empty string when name is undefined', () => {
    expect(personalize('Halo {name}!', undefined)).toBe('Halo !');
  });

  it('trims whitespace-only name to empty', () => {
    expect(personalize('Halo {name}!', '   ')).toBe('Halo !');
  });

  it('leaves message unchanged when no shortcode present', () => {
    expect(personalize('Promo akhir pekan!', 'Budi')).toBe('Promo akhir pekan!');
  });

  it('is case-sensitive ({name} matches, not {Name})', () => {
    expect(personalize('Halo {Name} {name}', 'Budi')).toBe('Halo {Name} Budi');
  });
});
