// Auto-generated from CSV header: 21-22 Fall Split  - 21-22 Fall Regional 1.csv
// Types: TEXT, INTEGER, BOOLEAN, TIMESTAMPTZ, DOUBLE PRECISION

export const createStatsTableSql = `
CREATE TABLE IF NOT EXISTS stats (
  id BIGSERIAL PRIMARY KEY,
  "Player Name" TEXT,
  "Unique ID" TEXT,
  "Player ID" TEXT,
  "Role" TEXT,
  "Date" TIMESTAMPTZ,
  "Match ID" TEXT,
  "Season" TEXT,
  "Split" TEXT,
  "Regional" TEXT,
  "Day" INTEGER,
  "Stage" TEXT,
  "Round" TEXT,
  "Best of " INTEGER,
  "Game Number" INTEGER,
  "Game" INTEGER,
  "Team" TEXT,
  "Victory" BOOLEAN,
  "Forfeit" BOOLEAN,
  "OT" BOOLEAN,
  "Extra Time" DOUBLE PRECISION,
  "Arena" TEXT,
  "Closest to Ball_All Zones" DOUBLE PRECISION,
  "Closest to Ball_Defense Zone" DOUBLE PRECISION,
  "Closest to Ball_Neutral Zone" DOUBLE PRECISION,
  "Closest to Ball_Offense Zone" DOUBLE PRECISION,
  "Furthest from Ball_All Zones" DOUBLE PRECISION,
  "Furthest from Ball_Defense Zone" DOUBLE PRECISION,
  "Furthest from Ball_Neutral Zone" DOUBLE PRECISION,
  "Furthest from Ball_Offense Zone" DOUBLE PRECISION,
  "First man_All Zones" DOUBLE PRECISION,
  "First man_Defense Zone" DOUBLE PRECISION,
  "First man_Neutral Zone" DOUBLE PRECISION,
  "First man_Offense Zone" DOUBLE PRECISION,
  "Last man_All Zones" DOUBLE PRECISION,
  "Last man_Defense Zone" DOUBLE PRECISION,
  "Last man_Neutral Zone" DOUBLE PRECISION,
  "Last man_Offense Zone" DOUBLE PRECISION,
  "Left Side_All Zones" DOUBLE PRECISION,
  "Left Side_Defense Zone" DOUBLE PRECISION,
  "Left Side_Neutral Zone" DOUBLE PRECISION,
  "Left Side_Offense Zone" DOUBLE PRECISION,
  "Right Side_All Zones" DOUBLE PRECISION,
  "Right Side_Defense Zone" DOUBLE PRECISION,
  "Right Side_Neutral Zone" DOUBLE PRECISION,
  "Right Side_Offense Zone" DOUBLE PRECISION,
  "Ball Touches_All Zones" DOUBLE PRECISION,
  "Ball Touches_Defense Zone" DOUBLE PRECISION,
  "Ball Touches_Neutral Zone" DOUBLE PRECISION,
  "Ball Touches_Offense Zone" DOUBLE PRECISION,
  "Time on Ball_All Zones" DOUBLE PRECISION,
  "Time on Ball_Defense Zone" DOUBLE PRECISION,
  "Time on Ball_Neutral Zone" DOUBLE PRECISION,
  "Time on Ball_Offense Zone" DOUBLE PRECISION,
  "Behind Ball_All Zones" DOUBLE PRECISION,
  "Behind Ball_Defense Zone" DOUBLE PRECISION,
  "Behind Ball_Neutral Zone" DOUBLE PRECISION,
  "Behind Ball_Offense Zone" DOUBLE PRECISION,
  "Ahead of Ball_All Zones" DOUBLE PRECISION,
  "Ahead of Ball_Defense Zone" DOUBLE PRECISION,
  "Ahead of Ball_Neutral Zone" DOUBLE PRECISION,
  "Ahead of Ball_Offense Zone" DOUBLE PRECISION,
  "Average Ball Distance_All Zones" DOUBLE PRECISION,
  "Average Ball Distance_Defense Zone" DOUBLE PRECISION,
  "Average Ball Distance_Neutral Zone" DOUBLE PRECISION,
  "Average Ball Distance_Offense Zone" DOUBLE PRECISION,
  "Distance traveled_All Zones" DOUBLE PRECISION,
  "Distance traveled_Defense Zone" DOUBLE PRECISION,
  "Distance traveled_Neutral Zone" DOUBLE PRECISION,
  "Distance traveled_Offense Zone" DOUBLE PRECISION,
  "Distance traveled on ground_All Zones" DOUBLE PRECISION,
  "Distance traveled on ground_Defense Zone" DOUBLE PRECISION,
  "Distance traveled on ground_Neutral Zone" DOUBLE PRECISION,
  "Distance traveled on ground_Offense Zone" DOUBLE PRECISION,
  "Distance traveled in the air_All Zones" DOUBLE PRECISION,
  "Distance traveled in the air_Defense Zone" DOUBLE PRECISION,
  "Distance traveled in the air_Neutral Zone" DOUBLE PRECISION,
  "Distance traveled in the air_Offense Zone" DOUBLE PRECISION,
  "Distance traveled in low air_All Zones" DOUBLE PRECISION,
  "Distance traveled in low air_Defense Zone" DOUBLE PRECISION,
  "Distance traveled in low air_Neutral Zone" DOUBLE PRECISION,
  "Distance traveled in low air_Offense Zone" DOUBLE PRECISION,
  "Distance traveled in high air_All Zones" DOUBLE PRECISION,
  "Distance traveled in high air_Defense Zone" DOUBLE PRECISION,
  "Distance traveled in high air_Neutral Zone" DOUBLE PRECISION,
  "Distance traveled in high air_Offense Zone" DOUBLE PRECISION,
  "Average Speed_All Zones" DOUBLE PRECISION,
  "Average Speed_Defense Zone" DOUBLE PRECISION,
  "Average Speed_Neutral Zone" DOUBLE PRECISION,
  "Average Speed_Offense Zone" DOUBLE PRECISION,
  "Max Speed (82.8)_All Zones" DOUBLE PRECISION,
  "Max Speed (82.8)_Defense Zone" DOUBLE PRECISION,
  "Max Speed (82.8)_Neutral Zone" DOUBLE PRECISION,
  "Max Speed (82.8)_Offense Zone" DOUBLE PRECISION,
  "SuperSonic (80+)_All Zones" DOUBLE PRECISION,
  "SuperSonic (80+)_Defense Zone" DOUBLE PRECISION,
  "SuperSonic (80+)_Neutral Zone" DOUBLE PRECISION,
  "SuperSonic (80+)_Offense Zone" DOUBLE PRECISION,
  "Boost Speed (50-79)_All Zones" DOUBLE PRECISION,
  "Boost Speed (50-79)_Defense Zone" DOUBLE PRECISION,
  "Boost Speed (50-79)_Neutral Zone" DOUBLE PRECISION,
  "Boost Speed (50-79)_Offense Zone" DOUBLE PRECISION,
  "Drive Speed (1-49)_All Zones" DOUBLE PRECISION,
  "Drive Speed (1-49)_Defense Zone" DOUBLE PRECISION,
  "Drive Speed (1-49)_Neutral Zone" DOUBLE PRECISION,
  "Drive Speed (1-49)_Offense Zone" DOUBLE PRECISION,
  "Stopped_All Zones" DOUBLE PRECISION,
  "Stopped_Defense Zone" DOUBLE PRECISION,
  "Stopped_Neutral Zone" DOUBLE PRECISION,
  "Stopped_Offense Zone" DOUBLE PRECISION,
  "On Ground_All Zones" DOUBLE PRECISION,
  "On Ground_Defense Zone" DOUBLE PRECISION,
  "On Ground_Neutral Zone" DOUBLE PRECISION,
  "On Ground_Offense Zone" DOUBLE PRECISION,
  "In Air_All Zones" DOUBLE PRECISION,
  "In Air_Defense Zone" DOUBLE PRECISION,
  "In Air_Neutral Zone" DOUBLE PRECISION,
  "In Air_Offense Zone" DOUBLE PRECISION,
  "In Low Air_All Zones" DOUBLE PRECISION,
  "In Low Air_Defense Zone" DOUBLE PRECISION,
  "In Low Air_Neutral Zone" DOUBLE PRECISION,
  "In Low Air_Offense Zone" DOUBLE PRECISION,
  "In High Air_All Zones" DOUBLE PRECISION,
  "In High Air_Defense Zone" DOUBLE PRECISION,
  "In High Air_Neutral Zone" DOUBLE PRECISION,
  "In High Air_Offense Zone" DOUBLE PRECISION,
  "Average Boost_All Zones" DOUBLE PRECISION,
  "Average Boost_Defense Zone" DOUBLE PRECISION,
  "Average Boost_Neutral Zone" DOUBLE PRECISION,
  "Average Boost_Offense Zone" DOUBLE PRECISION,
  "Empty (0)_All Zones" DOUBLE PRECISION,
  "Empty (0)_Defense Zone" DOUBLE PRECISION,
  "Empty (0)_Neutral Zone" DOUBLE PRECISION,
  "Empty (0)_Offense Zone" DOUBLE PRECISION,
  "Low (0-33)_All Zones" DOUBLE PRECISION,
  "Low (0-33)_Defense Zone" DOUBLE PRECISION,
  "Low (0-33)_Neutral Zone" DOUBLE PRECISION,
  "Low (0-33)_Offense Zone" DOUBLE PRECISION,
  "Medium (34-66)_All Zones" DOUBLE PRECISION,
  "Medium (34-66)_Defense Zone" DOUBLE PRECISION,
  "Medium (34-66)_Neutral Zone" DOUBLE PRECISION,
  "Medium (34-66)_Offense Zone" DOUBLE PRECISION,
  "High (67-100)_All Zones" DOUBLE PRECISION,
  "High (67-100)_Defense Zone" DOUBLE PRECISION,
  "High (67-100)_Neutral Zone" DOUBLE PRECISION,
  "High (67-100)_Offense Zone" DOUBLE PRECISION,
  "Full (100)_All Zones" DOUBLE PRECISION,
  "Full (100)_Defense Zone" DOUBLE PRECISION,
  "Full (100)_Neutral Zone" DOUBLE PRECISION,
  "Full (100)_Offense Zone" DOUBLE PRECISION,
  "Boost Gained_All Zones" DOUBLE PRECISION,
  "Boost Gained_Defense Zone" DOUBLE PRECISION,
  "Boost Gained_Neutral Zone" DOUBLE PRECISION,
  "Boost Gained_Offense Zone" DOUBLE PRECISION,
  "Boost Lost_All Zones" DOUBLE PRECISION,
  "Boost Lost_Defense Zone" DOUBLE PRECISION,
  "Boost Lost_Neutral Zone" DOUBLE PRECISION,
  "Boost Lost_Offense Zone" DOUBLE PRECISION,
  "Boost Lost while SuperSonic_All Zones" DOUBLE PRECISION,
  "Boost Lost while SuperSonic_Defense Zone" DOUBLE PRECISION,
  "Boost Lost while SuperSonic_Neutral Zone" DOUBLE PRECISION,
  "Boost Lost while SuperSonic_Offense Zone" DOUBLE PRECISION,
  "Boost Lost while Max Speed_All Zones" DOUBLE PRECISION,
  "Boost Lost while Max Speed_Defense Zone" DOUBLE PRECISION,
  "Boost Lost while Max Speed_Neutral Zone" DOUBLE PRECISION,
  "Boost Lost while Max Speed_Offense Zone" DOUBLE PRECISION,
  "Boost Lost on Ground_All Zones" DOUBLE PRECISION,
  "Boost Lost on Ground_Defense Zone" DOUBLE PRECISION,
  "Boost Lost on Ground_Neutral Zone" DOUBLE PRECISION,
  "Boost Lost on Ground_Offense Zone" DOUBLE PRECISION,
  "Boost Lost in Air_All Zones" DOUBLE PRECISION,
  "Boost Lost in Air_Defense Zone" DOUBLE PRECISION,
  "Boost Lost in Air_Neutral Zone" DOUBLE PRECISION,
  "Boost Lost in Air_Offense Zone" DOUBLE PRECISION,
  "Boost Lost in Low Air_All Zones" DOUBLE PRECISION,
  "Boost Lost in Low Air_Defense Zone" DOUBLE PRECISION,
  "Boost Lost in Low Air_Neutral Zone" DOUBLE PRECISION,
  "Boost Lost in Low Air_Offense Zone" DOUBLE PRECISION,
  "Boost Lost in High Air_All Zones" DOUBLE PRECISION,
  "Boost Lost in High Air_Defense Zone" DOUBLE PRECISION,
  "Boost Lost in High Air_Neutral Zone" DOUBLE PRECISION,
  "Boost Lost in High Air_Offense Zone" DOUBLE PRECISION,
  "Passes Given_All Zones" DOUBLE PRECISION,
  "Passes Given_Defense Zone" DOUBLE PRECISION,
  "Passes Given_Neutral Zone" DOUBLE PRECISION,
  "Passes Given_Offense Zone" DOUBLE PRECISION,
  "Passes Received_All Zones" DOUBLE PRECISION,
  "Passes Received_Defense Zone" DOUBLE PRECISION,
  "Passes Received_Neutral Zone" DOUBLE PRECISION,
  "Passes Received_Offense Zone" DOUBLE PRECISION,
  "50/50s_All Zones" DOUBLE PRECISION,
  "50/50s_Defense Zone" DOUBLE PRECISION,
  "50/50s_Neutral Zone" DOUBLE PRECISION,
  "50/50s_Offense Zone" DOUBLE PRECISION,
  "Possession Losses_All Zones" DOUBLE PRECISION,
  "Possession Losses_Defense Zone" DOUBLE PRECISION,
  "Possession Losses_Neutral Zone" DOUBLE PRECISION,
  "Possession Losses_Offense Zone" DOUBLE PRECISION,
  "Interceptions_All Zones" DOUBLE PRECISION,
  "Interceptions_Defense Zone" DOUBLE PRECISION,
  "Interceptions_Neutral Zone" DOUBLE PRECISION,
  "Interceptions_Offense Zone" DOUBLE PRECISION,
  "Self Touches_All Zones" DOUBLE PRECISION,
  "Self Touches_Defense Zone" DOUBLE PRECISION,
  "Self Touches_Neutral Zone" DOUBLE PRECISION,
  "Self Touches_Offense Zone" DOUBLE PRECISION,
  "Score_All Zones" DOUBLE PRECISION,
  "Score_Defense Zone" DOUBLE PRECISION,
  "Score_Neutral Zone" DOUBLE PRECISION,
  "Score_Offense Zone" DOUBLE PRECISION,
  "Goals_All Zones" DOUBLE PRECISION,
  "Goals_Defense Zone" DOUBLE PRECISION,
  "Goals_Neutral Zone" DOUBLE PRECISION,
  "Goals_Offense Zone" DOUBLE PRECISION,
  "Shots_All Zones" DOUBLE PRECISION,
  "Shots_Defense Zone" DOUBLE PRECISION,
  "Shots_Neutral Zone" DOUBLE PRECISION,
  "Shots_Offense Zone" DOUBLE PRECISION,
  "Assists_All Zones" DOUBLE PRECISION,
  "Assists_Defense Zone" DOUBLE PRECISION,
  "Assists_Neutral Zone" DOUBLE PRECISION,
  "Assists_Offense Zone" DOUBLE PRECISION,
  "Saves_All Zones" DOUBLE PRECISION,
  "Saves_Defense Zone" DOUBLE PRECISION,
  "Saves_Neutral Zone" DOUBLE PRECISION,
  "Saves_Offense Zone" DOUBLE PRECISION,
  "Kills_All Zones" DOUBLE PRECISION,
  "Kills_Defense Zone" DOUBLE PRECISION,
  "Kills_Neutral Zone" DOUBLE PRECISION,
  "Kills_Offense Zone" DOUBLE PRECISION,
  "Deaths_All Zones" DOUBLE PRECISION,
  "Deaths_Defense Zone" DOUBLE PRECISION,
  "Deaths_Neutral Zone" DOUBLE PRECISION, 
  "Deaths_Offense Zone" DOUBLE PRECISION,
  "Boost Lost When Demoed_All Zones" DOUBLE PRECISION,
  "Boost Lost When Demoed_Defense Zone" DOUBLE PRECISION,
  "Boost Lost When Demoed_Neutral Zone" DOUBLE PRECISION,
  "Boost Lost When Demoed_Offense Zone" DOUBLE PRECISION,
  "Avg Speed When Demoed_All Zones" DOUBLE PRECISION,
  "Avg Speed When Demoed_Defense Zone" DOUBLE PRECISION,
  "Avg Speed When Demoed_Neutral Zone" DOUBLE PRECISION,
  "Avg Speed When Demoed_Offense Zone" DOUBLE PRECISION,
  "Avg Speed After Killing_All Zones" DOUBLE PRECISION,
  "Avg Speed After Killing_Defense Zone" DOUBLE PRECISION,
  "Avg Speed After Killing_Neutral Zone" DOUBLE PRECISION,
  "Avg Speed After Killing_Offense Zone" DOUBLE PRECISION,
  "Avg Boost When Demoed_All Zones" DOUBLE PRECISION,
  "Avg Boost When Demoed_Defense Zone" DOUBLE PRECISION,
  "Avg Boost When Demoed_Neutral Zone" DOUBLE PRECISION,
  "Avg Boost When Demoed_Offense Zone" DOUBLE PRECISION,
  "Avg Boost When Killing_All Zones" DOUBLE PRECISION,
  "Avg Boost When Killing_Defense Zone" DOUBLE PRECISION,
  "Avg Boost When Killing_Neutral Zone" DOUBLE PRECISION,
  "Avg Boost When Killing_Offense Zone" DOUBLE PRECISION,
  "Small Pads Collected_All Zones" DOUBLE PRECISION,
  "Small Pads Collected_Defense Zone" DOUBLE PRECISION,
  "Small Pads Collected_Neutral Zone" DOUBLE PRECISION,
  "Small Pads Collected_Offense Zone" DOUBLE PRECISION,
  "Big Boosts Collected_All Zones" DOUBLE PRECISION,
  "Big Boosts Collected_Defense Zone" DOUBLE PRECISION,
  "Big Boosts Collected_Neutral Zone" DOUBLE PRECISION,
  "Big Boosts Collected_Offense Zone" DOUBLE PRECISION,
  "Overfill from Small Pads_All Zones" DOUBLE PRECISION,
  "Overfill from Small Pads_Defense Zone" DOUBLE PRECISION,
  "Overfill from Small Pads_Neutral Zone" DOUBLE PRECISION,
  "Overfill from Small Pads_Offense Zone" DOUBLE PRECISION,
  "Overfill from Big Boosts_All Zones" DOUBLE PRECISION,
  "Overfill from Big Boosts_Defense Zone" DOUBLE PRECISION,
  "Overfill from Big Boosts_Neutral Zone" DOUBLE PRECISION,
  "Overfill from Big Boosts_Offense Zone" DOUBLE PRECISION,
  "Boost Gained from Small Pads_All Zones" DOUBLE PRECISION,
  "Boost Gained from Small Pads_Defense Zone" DOUBLE PRECISION,
  "Boost Gained from Small Pads_Neutral Zone" DOUBLE PRECISION,
  "Boost Gained from Small Pads_Offense Zone" DOUBLE PRECISION,
  "Boost Gained from Big Boosts_All Zones" DOUBLE PRECISION,
  "Boost Gained from Big Boosts_Defense Zone" DOUBLE PRECISION,
  "Boost Gained from Big Boosts_Neutral Zone" DOUBLE PRECISION,
  "Boost Gained from Big Boosts_Offense Zone" DOUBLE PRECISION
);
`;

export const addStatsTableCommentsSql = `
COMMENT ON COLUMN stats."id" IS 'Primary key.';
COMMENT ON COLUMN stats."Player Name" IS 'Player display name.';
COMMENT ON COLUMN stats."Unique ID" IS 'Player identifier (unique player ID).';
COMMENT ON COLUMN stats."Player ID" IS 'Platform player ID; not necessarily unique.';
COMMENT ON COLUMN stats."Role" IS 'Player role in the match.';
COMMENT ON COLUMN stats."Date" IS 'Match date.';
COMMENT ON COLUMN stats."Match ID" IS 'Match identifier from source data.';
COMMENT ON COLUMN stats."Season" IS 'Season label.';
COMMENT ON COLUMN stats."Split" IS 'Season split label.';
COMMENT ON COLUMN stats."Regional" IS 'Regional event name.';
COMMENT ON COLUMN stats."Day" IS 'Event day number.';
COMMENT ON COLUMN stats."Stage" IS 'Event stage name.';
COMMENT ON COLUMN stats."Round" IS 'Round number or label.';
COMMENT ON COLUMN stats."Best of " IS 'Best-of series length.';
COMMENT ON COLUMN stats."Game Number" IS 'Game number within the series.';
COMMENT ON COLUMN stats."Game" IS 'Game identifier from source data.';
COMMENT ON COLUMN stats."Team" IS 'Team name or abbreviation.';
COMMENT ON COLUMN stats."Victory" IS 'Whether the player''s team won.';
COMMENT ON COLUMN stats."Forfeit" IS 'Whether the game was a forfeit.';
COMMENT ON COLUMN stats."OT" IS 'Whether the game went to overtime.';
COMMENT ON COLUMN stats."Extra Time" IS 'Overtime duration in seconds.';
COMMENT ON COLUMN stats."Arena" IS 'Arena name.';
COMMENT ON COLUMN stats."Closest to Ball_All Zones" IS 'Percent of time player was closest team member to the ball across all zones.';
COMMENT ON COLUMN stats."Closest to Ball_Defense Zone" IS 'Percent of time player was closest team member to the ball in the defense zone.';
COMMENT ON COLUMN stats."Closest to Ball_Neutral Zone" IS 'Percent of time player was closest team member to the ball in the neutral zone.';
COMMENT ON COLUMN stats."Closest to Ball_Offense Zone" IS 'Percent of time player was closest team member to the ball in the offense zone.';
COMMENT ON COLUMN stats."Furthest from Ball_All Zones" IS 'Percent of time player was furthest team member from the ball across all zones.';
COMMENT ON COLUMN stats."Furthest from Ball_Defense Zone" IS 'Percent of time player was furthest team member from the ball in the defense zone.';
COMMENT ON COLUMN stats."Furthest from Ball_Neutral Zone" IS 'Percent of time player was furthest team member from the ball in the neutral zone.';
COMMENT ON COLUMN stats."Furthest from Ball_Offense Zone" IS 'Percent of time player was furthest team member from the ball in the offense zone.';
COMMENT ON COLUMN stats."First man_All Zones" IS 'Percent of time player was furthest member forward on the field across all zones.';
COMMENT ON COLUMN stats."First man_Defense Zone" IS 'Percent of time player was furthest member forward on the field in the defense zone.';
COMMENT ON COLUMN stats."First man_Neutral Zone" IS 'Percent of time player was furthest member forward on the field in the neutral zone.';
COMMENT ON COLUMN stats."First man_Offense Zone" IS 'Percent of time player was furthest member forward on the field in the offense zone.';
COMMENT ON COLUMN stats."Last man_All Zones" IS 'Percent of time player was furthest member back on the field across all zones.';
COMMENT ON COLUMN stats."Last man_Defense Zone" IS 'Percent of time player was furthest member back on the field in the defense zone.';
COMMENT ON COLUMN stats."Last man_Neutral Zone" IS 'Percent of time player was furthest member back on the field in the neutral zone.';
COMMENT ON COLUMN stats."Last man_Offense Zone" IS 'Percent of time player was furthest member back on the field in the offense zone.';
COMMENT ON COLUMN stats."Left Side_All Zones" IS 'Percent of time player was on the left side of the field across all zones.';
COMMENT ON COLUMN stats."Left Side_Defense Zone" IS 'Percent of time player was on the left side of the field in the defense zone.';
COMMENT ON COLUMN stats."Left Side_Neutral Zone" IS 'Percent of time player was on the left side of the field in the neutral zone.';
COMMENT ON COLUMN stats."Left Side_Offense Zone" IS 'Percent of time player was on the left side of the field in the offense zone.';
COMMENT ON COLUMN stats."Right Side_All Zones" IS 'Percent of time player was on the right side of the field across all zones.';
COMMENT ON COLUMN stats."Right Side_Defense Zone" IS 'Percent of time player was on the right side of the field in the defense zone.';
COMMENT ON COLUMN stats."Right Side_Neutral Zone" IS 'Percent of time player was on the right side of the field in the neutral zone.';
COMMENT ON COLUMN stats."Right Side_Offense Zone" IS 'Percent of time player was on the right side of the field in the offense zone.';
COMMENT ON COLUMN stats."Ball Touches_All Zones" IS 'Number of times the player touched the ball across all zones.';
COMMENT ON COLUMN stats."Ball Touches_Defense Zone" IS 'Number of times the player touched the ball in the defense zone.';
COMMENT ON COLUMN stats."Ball Touches_Neutral Zone" IS 'Number of times the player touched the ball in the neutral zone.';
COMMENT ON COLUMN stats."Ball Touches_Offense Zone" IS 'Number of times the player touched the ball in the offense zone.';
COMMENT ON COLUMN stats."Time on Ball_All Zones" IS 'Percent of time player was last to touch the ball across all zones.';
COMMENT ON COLUMN stats."Time on Ball_Defense Zone" IS 'Percent of time player was last to touch the ball in the defense zone.';
COMMENT ON COLUMN stats."Time on Ball_Neutral Zone" IS 'Percent of time player was last to touch the ball in the neutral zone.';
COMMENT ON COLUMN stats."Time on Ball_Offense Zone" IS 'Percent of time player was last to touch the ball in the offense zone.';
COMMENT ON COLUMN stats."Behind Ball_All Zones" IS 'Percent of time player was behind the ball across all zones.';
COMMENT ON COLUMN stats."Behind Ball_Defense Zone" IS 'Percent of time player was behind the ball in the defense zone.';
COMMENT ON COLUMN stats."Behind Ball_Neutral Zone" IS 'Percent of time player was behind the ball in the neutral zone.';
COMMENT ON COLUMN stats."Behind Ball_Offense Zone" IS 'Percent of time player was behind the ball in the offense zone.';
COMMENT ON COLUMN stats."Ahead of Ball_All Zones" IS 'Percent of time player was ahead of the ball across all zones.';
COMMENT ON COLUMN stats."Ahead of Ball_Defense Zone" IS 'Percent of time player was ahead of the ball in the defense zone.';
COMMENT ON COLUMN stats."Ahead of Ball_Neutral Zone" IS 'Percent of time player was ahead of the ball in the neutral zone.';
COMMENT ON COLUMN stats."Ahead of Ball_Offense Zone" IS 'Percent of time player was ahead of the ball in the offense zone.';
COMMENT ON COLUMN stats."Average Ball Distance_All Zones" IS 'Average distance to the ball across all zones.';
COMMENT ON COLUMN stats."Average Ball Distance_Defense Zone" IS 'Average distance to the ball in the defense zone.';
COMMENT ON COLUMN stats."Average Ball Distance_Neutral Zone" IS 'Average distance to the ball in the neutral zone.';
COMMENT ON COLUMN stats."Average Ball Distance_Offense Zone" IS 'Average distance to the ball in the offense zone.';
COMMENT ON COLUMN stats."Distance traveled_All Zones" IS 'Distance the player traveled across all zones.';
COMMENT ON COLUMN stats."Distance traveled_Defense Zone" IS 'Distance the player traveled in the defense zone.';
COMMENT ON COLUMN stats."Distance traveled_Neutral Zone" IS 'Distance the player traveled in the neutral zone.';
COMMENT ON COLUMN stats."Distance traveled_Offense Zone" IS 'Distance the player traveled in the offense zone.';
COMMENT ON COLUMN stats."Distance traveled on ground_All Zones" IS 'Distance the player traveled on the ground across all zones.';
COMMENT ON COLUMN stats."Distance traveled on ground_Defense Zone" IS 'Distance the player traveled on the ground in the defense zone.';
COMMENT ON COLUMN stats."Distance traveled on ground_Neutral Zone" IS 'Distance the player traveled on the ground in the neutral zone.';
COMMENT ON COLUMN stats."Distance traveled on ground_Offense Zone" IS 'Distance the player traveled on the ground in the offense zone.';
COMMENT ON COLUMN stats."Distance traveled in the air_All Zones" IS 'Distance the player traveled in the air across all zones.';
COMMENT ON COLUMN stats."Distance traveled in the air_Defense Zone" IS 'Distance the player traveled in the air in the defense zone.';
COMMENT ON COLUMN stats."Distance traveled in the air_Neutral Zone" IS 'Distance the player traveled in the air in the neutral zone.';
COMMENT ON COLUMN stats."Distance traveled in the air_Offense Zone" IS 'Distance the player traveled in the air in the offense zone.';
COMMENT ON COLUMN stats."Distance traveled in low air_All Zones" IS 'Distance the player traveled in low air across all zones.';
COMMENT ON COLUMN stats."Distance traveled in low air_Defense Zone" IS 'Distance the player traveled in low air in the defense zone.';
COMMENT ON COLUMN stats."Distance traveled in low air_Neutral Zone" IS 'Distance the player traveled in low air in the neutral zone.';
COMMENT ON COLUMN stats."Distance traveled in low air_Offense Zone" IS 'Distance the player traveled in low air in the offense zone.';
COMMENT ON COLUMN stats."Distance traveled in high air_All Zones" IS 'Distance the player traveled in high air across all zones.';
COMMENT ON COLUMN stats."Distance traveled in high air_Defense Zone" IS 'Distance the player traveled in high air in the defense zone.';
COMMENT ON COLUMN stats."Distance traveled in high air_Neutral Zone" IS 'Distance the player traveled in high air in the neutral zone.';
COMMENT ON COLUMN stats."Distance traveled in high air_Offense Zone" IS 'Distance the player traveled in high air in the offense zone.';
COMMENT ON COLUMN stats."Average Speed_All Zones" IS 'Average speed of the player across all zones.';
COMMENT ON COLUMN stats."Average Speed_Defense Zone" IS 'Average speed of the player in the defense zone.';
COMMENT ON COLUMN stats."Average Speed_Neutral Zone" IS 'Average speed of the player in the neutral zone.';
COMMENT ON COLUMN stats."Average Speed_Offense Zone" IS 'Average speed of the player in the offense zone.';
COMMENT ON COLUMN stats."Max Speed (82.8)_All Zones" IS 'Percent of time player drove at max speed (82.8) across all zones.';
COMMENT ON COLUMN stats."Max Speed (82.8)_Defense Zone" IS 'Percent of time player drove at max speed (82.8) in the defense zone.';
COMMENT ON COLUMN stats."Max Speed (82.8)_Neutral Zone" IS 'Percent of time player drove at max speed (82.8) in the neutral zone.';
COMMENT ON COLUMN stats."Max Speed (82.8)_Offense Zone" IS 'Percent of time player drove at max speed (82.8) in the offense zone.';
COMMENT ON COLUMN stats."SuperSonic (80+)_All Zones" IS 'Percent of time player drove at supersonic speed (80+) across all zones.';
COMMENT ON COLUMN stats."SuperSonic (80+)_Defense Zone" IS 'Percent of time player drove at supersonic speed (80+) in the defense zone.';
COMMENT ON COLUMN stats."SuperSonic (80+)_Neutral Zone" IS 'Percent of time player drove at supersonic speed (80+) in the neutral zone.';
COMMENT ON COLUMN stats."SuperSonic (80+)_Offense Zone" IS 'Percent of time player drove at supersonic speed (80+) in the offense zone.';
COMMENT ON COLUMN stats."Boost Speed (50-79)_All Zones" IS 'Percent of time player drove between 50 and 79 speed across all zones.';
COMMENT ON COLUMN stats."Boost Speed (50-79)_Defense Zone" IS 'Percent of time player drove between 50 and 79 speed in the defense zone.';
COMMENT ON COLUMN stats."Boost Speed (50-79)_Neutral Zone" IS 'Percent of time player drove between 50 and 79 speed in the neutral zone.';
COMMENT ON COLUMN stats."Boost Speed (50-79)_Offense Zone" IS 'Percent of time player drove between 50 and 79 speed in the offense zone.';
COMMENT ON COLUMN stats."Drive Speed (1-49)_All Zones" IS 'Percent of time player drove between 1 and 49 speed across all zones.';
COMMENT ON COLUMN stats."Drive Speed (1-49)_Defense Zone" IS 'Percent of time player drove between 1 and 49 speed in the defense zone.';
COMMENT ON COLUMN stats."Drive Speed (1-49)_Neutral Zone" IS 'Percent of time player drove between 1 and 49 speed in the neutral zone.';
COMMENT ON COLUMN stats."Drive Speed (1-49)_Offense Zone" IS 'Percent of time player drove between 1 and 49 speed in the offense zone.';
COMMENT ON COLUMN stats."Stopped_All Zones" IS 'Percent of time player was not moving across all zones.';
COMMENT ON COLUMN stats."Stopped_Defense Zone" IS 'Percent of time player was not moving in the defense zone.';
COMMENT ON COLUMN stats."Stopped_Neutral Zone" IS 'Percent of time player was not moving in the neutral zone.';
COMMENT ON COLUMN stats."Stopped_Offense Zone" IS 'Percent of time player was not moving in the offense zone.';
COMMENT ON COLUMN stats."On Ground_All Zones" IS 'Percent of time player was on ground or wall across all zones.';
COMMENT ON COLUMN stats."On Ground_Defense Zone" IS 'Percent of time player was on ground or wall in the defense zone.';
COMMENT ON COLUMN stats."On Ground_Neutral Zone" IS 'Percent of time player was on ground or wall in the neutral zone.';
COMMENT ON COLUMN stats."On Ground_Offense Zone" IS 'Percent of time player was on ground or wall in the offense zone.';
COMMENT ON COLUMN stats."In Air_All Zones" IS 'Percent of time player was in the air across all zones.';
COMMENT ON COLUMN stats."In Air_Defense Zone" IS 'Percent of time player was in the air in the defense zone.';
COMMENT ON COLUMN stats."In Air_Neutral Zone" IS 'Percent of time player was in the air in the neutral zone.';
COMMENT ON COLUMN stats."In Air_Offense Zone" IS 'Percent of time player was in the air in the offense zone.';
COMMENT ON COLUMN stats."In Low Air_All Zones" IS 'Percent of time player was in low air across all zones.';
COMMENT ON COLUMN stats."In Low Air_Defense Zone" IS 'Percent of time player was in low air in the defense zone.';
COMMENT ON COLUMN stats."In Low Air_Neutral Zone" IS 'Percent of time player was in low air in the neutral zone.';
COMMENT ON COLUMN stats."In Low Air_Offense Zone" IS 'Percent of time player was in low air in the offense zone.';
COMMENT ON COLUMN stats."In High Air_All Zones" IS 'Percent of time player was in high air across all zones.';
COMMENT ON COLUMN stats."In High Air_Defense Zone" IS 'Percent of time player was in high air in the defense zone.';
COMMENT ON COLUMN stats."In High Air_Neutral Zone" IS 'Percent of time player was in high air in the neutral zone.';
COMMENT ON COLUMN stats."In High Air_Offense Zone" IS 'Percent of time player was in high air in the offense zone.';
COMMENT ON COLUMN stats."Average Boost_All Zones" IS 'Average boost amount in the player''s tank across all zones.';
COMMENT ON COLUMN stats."Average Boost_Defense Zone" IS 'Average boost amount in the player''s tank in the defense zone.';
COMMENT ON COLUMN stats."Average Boost_Neutral Zone" IS 'Average boost amount in the player''s tank in the neutral zone.';
COMMENT ON COLUMN stats."Average Boost_Offense Zone" IS 'Average boost amount in the player''s tank in the offense zone.';
COMMENT ON COLUMN stats."Empty (0)_All Zones" IS 'Percent of time player had 0 boost across all zones.';
COMMENT ON COLUMN stats."Empty (0)_Defense Zone" IS 'Percent of time player had 0 boost in the defense zone.';
COMMENT ON COLUMN stats."Empty (0)_Neutral Zone" IS 'Percent of time player had 0 boost in the neutral zone.';
COMMENT ON COLUMN stats."Empty (0)_Offense Zone" IS 'Percent of time player had 0 boost in the offense zone.';
COMMENT ON COLUMN stats."Low (0-33)_All Zones" IS 'Percent of time player had 0-33 boost across all zones.';
COMMENT ON COLUMN stats."Low (0-33)_Defense Zone" IS 'Percent of time player had 0-33 boost in the defense zone.';
COMMENT ON COLUMN stats."Low (0-33)_Neutral Zone" IS 'Percent of time player had 0-33 boost in the neutral zone.';
COMMENT ON COLUMN stats."Low (0-33)_Offense Zone" IS 'Percent of time player had 0-33 boost in the offense zone.';
COMMENT ON COLUMN stats."Medium (34-66)_All Zones" IS 'Percent of time player had 34-66 boost across all zones.';
COMMENT ON COLUMN stats."Medium (34-66)_Defense Zone" IS 'Percent of time player had 34-66 boost in the defense zone.';
COMMENT ON COLUMN stats."Medium (34-66)_Neutral Zone" IS 'Percent of time player had 34-66 boost in the neutral zone.';
COMMENT ON COLUMN stats."Medium (34-66)_Offense Zone" IS 'Percent of time player had 34-66 boost in the offense zone.';
COMMENT ON COLUMN stats."High (67-100)_All Zones" IS 'Percent of time player had 67-100 boost across all zones.';
COMMENT ON COLUMN stats."High (67-100)_Defense Zone" IS 'Percent of time player had 67-100 boost in the defense zone.';
COMMENT ON COLUMN stats."High (67-100)_Neutral Zone" IS 'Percent of time player had 67-100 boost in the neutral zone.';
COMMENT ON COLUMN stats."High (67-100)_Offense Zone" IS 'Percent of time player had 67-100 boost in the offense zone.';
COMMENT ON COLUMN stats."Full (100)_All Zones" IS 'Percent of time player had 100 boost across all zones.';
COMMENT ON COLUMN stats."Full (100)_Defense Zone" IS 'Percent of time player had 100 boost in the defense zone.';
COMMENT ON COLUMN stats."Full (100)_Neutral Zone" IS 'Percent of time player had 100 boost in the neutral zone.';
COMMENT ON COLUMN stats."Full (100)_Offense Zone" IS 'Percent of time player had 100 boost in the offense zone.';
COMMENT ON COLUMN stats."Boost Gained_All Zones" IS 'Amount of boost gained during the game across all zones.';
COMMENT ON COLUMN stats."Boost Gained_Defense Zone" IS 'Amount of boost gained during the game in the defense zone.';
COMMENT ON COLUMN stats."Boost Gained_Neutral Zone" IS 'Amount of boost gained during the game in the neutral zone.';
COMMENT ON COLUMN stats."Boost Gained_Offense Zone" IS 'Amount of boost gained during the game in the offense zone.';
COMMENT ON COLUMN stats."Boost Lost_All Zones" IS 'Amount of boost lost during the game across all zones.';
COMMENT ON COLUMN stats."Boost Lost_Defense Zone" IS 'Amount of boost lost during the game in the defense zone.';
COMMENT ON COLUMN stats."Boost Lost_Neutral Zone" IS 'Amount of boost lost during the game in the neutral zone.';
COMMENT ON COLUMN stats."Boost Lost_Offense Zone" IS 'Amount of boost lost during the game in the offense zone.';
COMMENT ON COLUMN stats."Boost Lost while SuperSonic_All Zones" IS 'Boost lost while going supersonic speed across all zones.';
COMMENT ON COLUMN stats."Boost Lost while SuperSonic_Defense Zone" IS 'Boost lost while going supersonic speed in the defense zone.';
COMMENT ON COLUMN stats."Boost Lost while SuperSonic_Neutral Zone" IS 'Boost lost while going supersonic speed in the neutral zone.';
COMMENT ON COLUMN stats."Boost Lost while SuperSonic_Offense Zone" IS 'Boost lost while going supersonic speed in the offense zone.';
COMMENT ON COLUMN stats."Boost Lost while Max Speed_All Zones" IS 'Boost lost while going max speed across all zones.';
COMMENT ON COLUMN stats."Boost Lost while Max Speed_Defense Zone" IS 'Boost lost while going max speed in the defense zone.';
COMMENT ON COLUMN stats."Boost Lost while Max Speed_Neutral Zone" IS 'Boost lost while going max speed in the neutral zone.';
COMMENT ON COLUMN stats."Boost Lost while Max Speed_Offense Zone" IS 'Boost lost while going max speed in the offense zone.';
COMMENT ON COLUMN stats."Boost Lost on Ground_All Zones" IS 'Boost lost while on the ground across all zones.';
COMMENT ON COLUMN stats."Boost Lost on Ground_Defense Zone" IS 'Boost lost while on the ground in the defense zone.';
COMMENT ON COLUMN stats."Boost Lost on Ground_Neutral Zone" IS 'Boost lost while on the ground in the neutral zone.';
COMMENT ON COLUMN stats."Boost Lost on Ground_Offense Zone" IS 'Boost lost while on the ground in the offense zone.';
COMMENT ON COLUMN stats."Boost Lost in Air_All Zones" IS 'Boost lost while in the air across all zones.';
COMMENT ON COLUMN stats."Boost Lost in Air_Defense Zone" IS 'Boost lost while in the air in the defense zone.';
COMMENT ON COLUMN stats."Boost Lost in Air_Neutral Zone" IS 'Boost lost while in the air in the neutral zone.';
COMMENT ON COLUMN stats."Boost Lost in Air_Offense Zone" IS 'Boost lost while in the air in the offense zone.';
COMMENT ON COLUMN stats."Boost Lost in Low Air_All Zones" IS 'Boost lost while in low air across all zones.';
COMMENT ON COLUMN stats."Boost Lost in Low Air_Defense Zone" IS 'Boost lost while in low air in the defense zone.';
COMMENT ON COLUMN stats."Boost Lost in Low Air_Neutral Zone" IS 'Boost lost while in low air in the neutral zone.';
COMMENT ON COLUMN stats."Boost Lost in Low Air_Offense Zone" IS 'Boost lost while in low air in the offense zone.';
COMMENT ON COLUMN stats."Boost Lost in High Air_All Zones" IS 'Boost lost while in high air across all zones.';
COMMENT ON COLUMN stats."Boost Lost in High Air_Defense Zone" IS 'Boost lost while in high air in the defense zone.';
COMMENT ON COLUMN stats."Boost Lost in High Air_Neutral Zone" IS 'Boost lost while in high air in the neutral zone.';
COMMENT ON COLUMN stats."Boost Lost in High Air_Offense Zone" IS 'Boost lost while in high air in the offense zone.';
COMMENT ON COLUMN stats."Passes Given_All Zones" IS 'Number of passes given to teammates across all zones.';
COMMENT ON COLUMN stats."Passes Given_Defense Zone" IS 'Number of passes given to teammates in the defense zone.';
COMMENT ON COLUMN stats."Passes Given_Neutral Zone" IS 'Number of passes given to teammates in the neutral zone.';
COMMENT ON COLUMN stats."Passes Given_Offense Zone" IS 'Number of passes given to teammates in the offense zone.';
COMMENT ON COLUMN stats."Passes Received_All Zones" IS 'Number of passes received from teammates across all zones.';
COMMENT ON COLUMN stats."Passes Received_Defense Zone" IS 'Number of passes received from teammates in the defense zone.';
COMMENT ON COLUMN stats."Passes Received_Neutral Zone" IS 'Number of passes received from teammates in the neutral zone.';
COMMENT ON COLUMN stats."Passes Received_Offense Zone" IS 'Number of passes received from teammates in the offense zone.';
COMMENT ON COLUMN stats."50/50s_All Zones" IS 'Number of 50/50s against opponents across all zones.';
COMMENT ON COLUMN stats."50/50s_Defense Zone" IS 'Number of 50/50s against opponents in the defense zone.';
COMMENT ON COLUMN stats."50/50s_Neutral Zone" IS 'Number of 50/50s against opponents in the neutral zone.';
COMMENT ON COLUMN stats."50/50s_Offense Zone" IS 'Number of 50/50s against opponents in the offense zone.';
COMMENT ON COLUMN stats."Possession Losses_All Zones" IS 'Number of times possession was lost to opponents across all zones.';
COMMENT ON COLUMN stats."Possession Losses_Defense Zone" IS 'Number of times possession was lost to opponents in the defense zone.';
COMMENT ON COLUMN stats."Possession Losses_Neutral Zone" IS 'Number of times possession was lost to opponents in the neutral zone.';
COMMENT ON COLUMN stats."Possession Losses_Offense Zone" IS 'Number of times possession was lost to opponents in the offense zone.';
COMMENT ON COLUMN stats."Interceptions_All Zones" IS 'Number of opponent possessions intercepted across all zones.';
COMMENT ON COLUMN stats."Interceptions_Defense Zone" IS 'Number of opponent possessions intercepted in the defense zone.';
COMMENT ON COLUMN stats."Interceptions_Neutral Zone" IS 'Number of opponent possessions intercepted in the neutral zone.';
COMMENT ON COLUMN stats."Interceptions_Offense Zone" IS 'Number of opponent possessions intercepted in the offense zone.';
COMMENT ON COLUMN stats."Self Touches_All Zones" IS 'Number of times player touched and followed up across all zones.';
COMMENT ON COLUMN stats."Self Touches_Defense Zone" IS 'Number of times player touched and followed up in the defense zone.';
COMMENT ON COLUMN stats."Self Touches_Neutral Zone" IS 'Number of times player touched and followed up in the neutral zone.';
COMMENT ON COLUMN stats."Self Touches_Offense Zone" IS 'Number of times player touched and followed up in the offense zone.';
COMMENT ON COLUMN stats."Score_All Zones" IS 'Points earned by the player across all zones (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Score_Defense Zone" IS 'Points earned by the player in the defense zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Score_Neutral Zone" IS 'Points earned by the player in the neutral zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Score_Offense Zone" IS 'Points earned by the player in the offense zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Goals_All Zones" IS 'Goals scored by the player across all zones (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Goals_Defense Zone" IS 'Goals scored by the player in the defense zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Goals_Neutral Zone" IS 'Goals scored by the player in the neutral zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Goals_Offense Zone" IS 'Goals scored by the player in the offense zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Shots_All Zones" IS 'Shots taken by the player across all zones (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Shots_Defense Zone" IS 'Shots taken by the player in the defense zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Shots_Neutral Zone" IS 'Shots taken by the player in the neutral zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Shots_Offense Zone" IS 'Shots taken by the player in the offense zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Assists_All Zones" IS 'Assists recorded by the player across all zones (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Assists_Defense Zone" IS 'Assists recorded by the player in the defense zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Assists_Neutral Zone" IS 'Assists recorded by the player in the neutral zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Assists_Offense Zone" IS 'Assists recorded by the player in the offense zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Saves_All Zones" IS 'Saves recorded by the player across all zones (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Saves_Defense Zone" IS 'Saves recorded by the player in the defense zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Saves_Neutral Zone" IS 'Saves recorded by the player in the neutral zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Saves_Offense Zone" IS 'Saves recorded by the player in the offense zone (source normalizes per 300s; overtime can introduce decimals).';
COMMENT ON COLUMN stats."Kills_All Zones" IS 'Demolitions performed on opponents across all zones.';
COMMENT ON COLUMN stats."Kills_Defense Zone" IS 'Demolitions performed on opponents in the defense zone.';
COMMENT ON COLUMN stats."Kills_Neutral Zone" IS 'Demolitions performed on opponents in the neutral zone.';
COMMENT ON COLUMN stats."Kills_Offense Zone" IS 'Demolitions performed on opponents in the offense zone.';
COMMENT ON COLUMN stats."Deaths_All Zones" IS 'Times the player was demolished across all zones.';
COMMENT ON COLUMN stats."Deaths_Defense Zone" IS 'Times the player was demolished in the defense zone.';
COMMENT ON COLUMN stats."Deaths_Neutral Zone" IS 'Times the player was demolished in the neutral zone.';
COMMENT ON COLUMN stats."Deaths_Offense Zone" IS 'Times the player was demolished in the offense zone.';
COMMENT ON COLUMN stats."Boost Lost When Demoed_All Zones" IS 'Boost lost when the player was demolished across all zones.';
COMMENT ON COLUMN stats."Boost Lost When Demoed_Defense Zone" IS 'Boost lost when the player was demolished in the defense zone.';
COMMENT ON COLUMN stats."Boost Lost When Demoed_Neutral Zone" IS 'Boost lost when the player was demolished in the neutral zone.';
COMMENT ON COLUMN stats."Boost Lost When Demoed_Offense Zone" IS 'Boost lost when the player was demolished in the offense zone.';
COMMENT ON COLUMN stats."Avg Speed When Demoed_All Zones" IS 'Average speed when the player was demolished across all zones.';
COMMENT ON COLUMN stats."Avg Speed When Demoed_Defense Zone" IS 'Average speed when the player was demolished in the defense zone.';
COMMENT ON COLUMN stats."Avg Speed When Demoed_Neutral Zone" IS 'Average speed when the player was demolished in the neutral zone.';
COMMENT ON COLUMN stats."Avg Speed When Demoed_Offense Zone" IS 'Average speed when the player was demolished in the offense zone.';
COMMENT ON COLUMN stats."Avg Speed After Killing_All Zones" IS 'Average speed after demolishing an opponent across all zones.';
COMMENT ON COLUMN stats."Avg Speed After Killing_Defense Zone" IS 'Average speed after demolishing an opponent in the defense zone.';
COMMENT ON COLUMN stats."Avg Speed After Killing_Neutral Zone" IS 'Average speed after demolishing an opponent in the neutral zone.';
COMMENT ON COLUMN stats."Avg Speed After Killing_Offense Zone" IS 'Average speed after demolishing an opponent in the offense zone.';
COMMENT ON COLUMN stats."Avg Boost When Demoed_All Zones" IS 'Average boost when the player was demolished across all zones.';
COMMENT ON COLUMN stats."Avg Boost When Demoed_Defense Zone" IS 'Average boost when the player was demolished in the defense zone.';
COMMENT ON COLUMN stats."Avg Boost When Demoed_Neutral Zone" IS 'Average boost when the player was demolished in the neutral zone.';
COMMENT ON COLUMN stats."Avg Boost When Demoed_Offense Zone" IS 'Average boost when the player was demolished in the offense zone.';
COMMENT ON COLUMN stats."Avg Boost When Killing_All Zones" IS 'Average boost when demolishing an opponent across all zones.';
COMMENT ON COLUMN stats."Avg Boost When Killing_Defense Zone" IS 'Average boost when demolishing an opponent in the defense zone.';
COMMENT ON COLUMN stats."Avg Boost When Killing_Neutral Zone" IS 'Average boost when demolishing an opponent in the neutral zone.';
COMMENT ON COLUMN stats."Avg Boost When Killing_Offense Zone" IS 'Average boost when demolishing an opponent in the offense zone.';
COMMENT ON COLUMN stats."Small Pads Collected_All Zones" IS 'Small boost pads collected by the player across all zones.';
COMMENT ON COLUMN stats."Small Pads Collected_Defense Zone" IS 'Small boost pads collected by the player in the defense zone.';
COMMENT ON COLUMN stats."Small Pads Collected_Neutral Zone" IS 'Small boost pads collected by the player in the neutral zone.';
COMMENT ON COLUMN stats."Small Pads Collected_Offense Zone" IS 'Small boost pads collected by the player in the offense zone.';
COMMENT ON COLUMN stats."Big Boosts Collected_All Zones" IS 'Big boost pads collected by the player across all zones.';
COMMENT ON COLUMN stats."Big Boosts Collected_Defense Zone" IS 'Big boost pads collected by the player in the defense zone.';
COMMENT ON COLUMN stats."Big Boosts Collected_Neutral Zone" IS 'Big boost pads collected by the player in the neutral zone.';
COMMENT ON COLUMN stats."Big Boosts Collected_Offense Zone" IS 'Big boost pads collected by the player in the offense zone.';
COMMENT ON COLUMN stats."Overfill from Small Pads_All Zones" IS 'Wasted boost from small pad pickups across all zones.';
COMMENT ON COLUMN stats."Overfill from Small Pads_Defense Zone" IS 'Wasted boost from small pad pickups in the defense zone.';
COMMENT ON COLUMN stats."Overfill from Small Pads_Neutral Zone" IS 'Wasted boost from small pad pickups in the neutral zone.';
COMMENT ON COLUMN stats."Overfill from Small Pads_Offense Zone" IS 'Wasted boost from small pad pickups in the offense zone.';
COMMENT ON COLUMN stats."Overfill from Big Boosts_All Zones" IS 'Wasted boost from big pad pickups across all zones.';
COMMENT ON COLUMN stats."Overfill from Big Boosts_Defense Zone" IS 'Wasted boost from big pad pickups in the defense zone.';
COMMENT ON COLUMN stats."Overfill from Big Boosts_Neutral Zone" IS 'Wasted boost from big pad pickups in the neutral zone.';
COMMENT ON COLUMN stats."Overfill from Big Boosts_Offense Zone" IS 'Wasted boost from big pad pickups in the offense zone.';
COMMENT ON COLUMN stats."Boost Gained from Small Pads_All Zones" IS 'Boost gained from small pads after overfill across all zones.';
COMMENT ON COLUMN stats."Boost Gained from Small Pads_Defense Zone" IS 'Boost gained from small pads after overfill in the defense zone.';
COMMENT ON COLUMN stats."Boost Gained from Small Pads_Neutral Zone" IS 'Boost gained from small pads after overfill in the neutral zone.';
COMMENT ON COLUMN stats."Boost Gained from Small Pads_Offense Zone" IS 'Boost gained from small pads after overfill in the offense zone.';
COMMENT ON COLUMN stats."Boost Gained from Big Boosts_All Zones" IS 'Boost gained from big boosts after overfill across all zones.';
COMMENT ON COLUMN stats."Boost Gained from Big Boosts_Defense Zone" IS 'Boost gained from big boosts after overfill in the defense zone.';
COMMENT ON COLUMN stats."Boost Gained from Big Boosts_Neutral Zone" IS 'Boost gained from big boosts after overfill in the neutral zone.';
COMMENT ON COLUMN stats."Boost Gained from Big Boosts_Offense Zone" IS 'Boost gained from big boosts after overfill in the offense zone.';
COMMENT ON COLUMN stats."source_file" IS 'Source filename for the ingested row.';
COMMENT ON COLUMN stats."ingested_at" IS 'Timestamp when the row was ingested.';
COMMENT ON COLUMN stats."row_hash" IS 'Deterministic hash for the row contents.';
`;
