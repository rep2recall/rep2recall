pragma foreign_keys = off;

create table `user` (
  `_id` varchar not null,
  `name` varchar not null,
  `email` varchar not null,
  `api_key` varchar not null,
  primary key (`_id`)
);
create unique index `user_email_unique` on `user` (`email`);

create table `template` (
  `_id` varchar not null,
  `name` varchar not null,
  `description` varchar null,
  `front` varchar not null,
  `back` varchar null,
  primary key (`_id`)
);
create index `template_name_index` on `template` (`name`);

create table `user_templates` (
  `user__id` varchar not null,
  `template__id` varchar not null,
  primary key (`user__id`, `template__id`)
);
create index `user_templates_user__id_index` on `user_templates` (`user__id`);
create index `user_templates_template__id_index` on `user_templates` (`template__id`);

create table `note` (
  `_id` varchar not null,
  primary key (`_id`)
);

create table `note_attr` (
  `_id` varchar not null,
  `key` varchar not null,
  `value` varchar not null,
  `note__id` varchar not null, /* Do not ALTER TABLE */
  primary key (`_id`)
);
create unique index `note_attr_key_note__id_unique` on `note_attr` (`key`, `note__id`);

create table `quiz` (
  `_id` varchar not null,
  `front` varchar null,
  `back` varchar null,
  `mnemonic` varchar null,
  `srs_level` integer null,
  `next_review` DATE null,
  `right_streak` integer null,
  `wrong_streak` integer null,
  `max_right` integer null,
  `max_wrong` integer null,
  `last_right` DATE null,
  `last_wrong` DATE null,
  `user__id` varchar not null, /* Do not ALTER TABLE */
  `note__id` varchar not null, /* Do not ALTER TABLE */
  `template__id` varchar not null, /* Do not ALTER TABLE */
  primary key (`_id`)
);
create index `quiz_srs_level_index` on `quiz` (`srs_level`);
create index `quiz_next_review_index` on `quiz` (`next_review`);
create index `quiz_wrong_streak_index` on `quiz` (`wrong_streak`);
create index `quiz_max_wrong_index` on `quiz` (`max_wrong`);
create index `quiz_last_wrong_index` on `quiz` (`last_wrong`);
create unique index `quiz_user__id_note__id_template__id_unique` on `quiz` (`user__id`, `note__id`, `template__id`);

create table `user_notes` (
  `user__id` varchar not null,
  `note__id` varchar not null,
  primary key (`user__id`, `note__id`)
);
create index `user_notes_user__id_index` on `user_notes` (`user__id`);
create index `user_notes_note__id_index` on `user_notes` (`note__id`);

create table `deck` (
  `_id` varchar not null,
  `name` TEXT not null, primary key (`_id`)
);
create unique index `deck_name_unique` on `deck` (`name`);

create index `note_attr_note__id_index` on `note_attr` (`note__id`);

create index `quiz_user__id_index` on `quiz` (`user__id`);
create index `quiz_note__id_index` on `quiz` (`note__id`);
create index `quiz_template__id_index` on `quiz` (`template__id`);

pragma foreign_keys = on;