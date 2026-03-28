# Pages Specification - Behind the Scenes Page

## Purpose

This specification defines the behavior of the "Cómo lo hice" (Behind the Scenes) page — a public route for displaying hackathon development process videos embedded from YouTube.

## Requirements

### Requirement: Public Route Access

The system SHALL provide a public route at `/como-lo-hice` accessible without authentication.

#### Scenario: Anonymous user accesses page

- GIVEN a user visits the application
- WHEN they navigate to `/como-lo-hice`
- THEN the page MUST load successfully without requiring authentication
- AND the page MUST respond with HTTP status 200

#### Scenario: Authenticated user accesses page

- GIVEN a user is logged into the application
- WHEN they navigate to `/como-lo-hice`
- THEN the page MUST load successfully
- AND authentication state MUST NOT affect page accessibility

### Requirement: Video Data Loading

The system MUST fetch video metadata from `/public/videos.json` asynchronously.

#### Scenario: Successful JSON fetch

- GIVEN the user navigates to `/como-lo-hice`
- WHEN the page loads
- THEN the system MUST fetch `/public/videos.json`
- AND the system MUST display a loading state while fetching
- AND the system MUST parse the JSON response successfully
- AND videos MUST be sorted by `id` in ascending order

#### Scenario: JSON file missing

- GIVEN the `/public/videos.json` file does not exist
- WHEN the page attempts to fetch the data
- THEN the system MUST display an error message
- AND the error message MUST be user-friendly
- AND the page MUST NOT crash or display a blank screen

#### Scenario: JSON malformed

- GIVEN the `/public/videos.json` file exists but contains invalid JSON
- WHEN the page attempts to parse the data
- THEN the system MUST display an error message
- AND the error message MUST indicate a data format issue
- AND the page MUST remain functional (no JavaScript errors)

### Requirement: Hero Section Display

The system MUST display hero section content from the JSON `hero` object.

#### Scenario: Hero displays correctly

- GIVEN the JSON data contains a `hero` object with `title` and `description` fields
- WHEN the page loads successfully
- THEN the hero section MUST display the title from `hero.title`
- AND the hero section MUST display the description from `hero.description`
- AND the styling MUST be consistent with the site theme

#### Scenario: Hero fields missing

- GIVEN the JSON data is missing `hero.title` or `hero.description`
- WHEN the page attempts to render the hero
- THEN the system MUST use fallback values
- OR the system MUST omit the missing field gracefully

### Requirement: Featured Video Display

The system MAY display a featured video when the JSON `featured` field is not null.

#### Scenario: Featured video present

- GIVEN the JSON data contains a `featured` object with `videoId`, `title`, and `description`
- WHEN the page loads successfully
- THEN the system MUST display the featured video prominently
- AND the video MUST be embedded using YouTube iframe format
- AND the iframe MUST have responsive 16:9 aspect ratio
- AND the full description MUST be displayed

#### Scenario: Featured video absent

- GIVEN the JSON data has `featured` set to `null`
- WHEN the page loads successfully
- THEN the system MUST NOT display a featured video section
- AND the page MUST render without errors

#### Scenario: Featured video incomplete

- GIVEN the JSON `featured` object is missing required fields (`videoId`, `title`, or `description`)
- WHEN the page attempts to render the featured video
- THEN the system MUST skip rendering the featured video
- OR the system MUST display a fallback state

### Requirement: Video Grid Display

The system MUST display all videos from the JSON `videos` array in a grid layout.

#### Scenario: Video grid displays all videos

- GIVEN the JSON data contains a `videos` array with video objects
- WHEN the page loads successfully
- THEN the system MUST display a card for each video
- AND each card MUST show the YouTube thumbnail from `img.youtube.com/vi/{videoId}/maxresdefault.jpg`
- AND each card MUST show the video title
- AND each card MUST show the video description
- AND videos MUST be sorted by `id` in ascending order

#### Scenario: Video grid with single video

- GIVEN the JSON data contains a `videos` array with only one video object
- WHEN the page loads successfully
- THEN the system MUST display the single video card
- AND the grid layout MUST remain visually balanced

#### Scenario: Video grid empty

- GIVEN the JSON data contains an empty `videos` array
- WHEN the page loads successfully
- THEN the system MUST display an empty state message
- AND the message MUST indicate no videos are available

### Requirement: YouTube Video Playback

The system MUST enable users to watch videos by clicking on video cards.

#### Scenario: Clicking video card plays video

- GIVEN the video grid is displayed
- WHEN the user clicks on a video card
- THEN the video MUST play in a YouTube iframe embed
- OR the video MUST open in a modal/overlay with YouTube embed
- AND the iframe MUST use the format `youtube.com/embed/{videoId}`

#### Scenario: YouTube iframe responsive

- GIVEN a YouTube video iframe is displayed
- WHEN the user views the page on different screen sizes
- THEN the iframe MUST maintain responsive behavior
- AND the aspect ratio MUST remain 16:9
- AND the iframe MUST fit within the container width

### Requirement: Navigation Integration

The system MUST include a navigation link to the "Behind the Scenes" page.

#### Scenario: Navigation link visible

- GIVEN the main navigation is displayed
- WHEN the user views the navigation menu
- THEN a link labeled "Cómo lo hice" MUST be present
- AND the link MUST be positioned after the "Explore" link
- AND clicking the link MUST navigate to `/como-lo-hice`

### Requirement: Loading and Error States

The system MUST provide visual feedback during data loading and error conditions.

#### Scenario: Loading state displayed

- GIVEN the user navigates to `/como-lo-hice`
- WHILE the JSON data is being fetched
- THEN a loading indicator MUST be displayed
- AND the loading indicator MUST be consistent with site patterns

#### Scenario: Error state displayed

- GIVEN the JSON fetch fails or returns invalid data
- WHEN the error is detected
- THEN an error message MUST be displayed
- AND the error message MUST explain the issue
- AND the page MUST suggest a remedy (e.g., refresh the page)

### Requirement: Responsive Design

The system MUST display the page correctly on mobile and desktop viewports.

#### Scenario: Desktop display

- GIVEN the user views the page on a desktop viewport (1024px or wider)
- WHEN the page loads successfully
- THEN the layout MUST use a multi-column grid for videos
- AND the featured video MUST display at maximum width
- AND the content MUST be properly spaced

#### Scenario: Mobile display

- GIVEN the user views the page on a mobile viewport (768px or narrower)
- WHEN the page loads successfully
- THEN the layout MUST stack vertically
- AND video cards MUST be full width
- AND touch interactions MUST work correctly
