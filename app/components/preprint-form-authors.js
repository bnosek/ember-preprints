import Ember from 'ember';
import CpPanelBodyComponent from 'ember-collapsible-panel/components/cp-panel-body';
import { permissionSelector } from 'ember-osf/const/permissions';

export default CpPanelBodyComponent.extend({
    valid: Ember.computed.alias('newContributorId'),
    authorModification: false,
    // Permissions labels for dropdown
    permissionOptions: permissionSelector,
    addState: 'emptyView', // There are 3 view states on left side of Authors panel. Default state just shows search bar.
    query: null,
    // Total contributor search results
    totalSearchResults: Ember.computed('searchResults.[]', function() {
        let searchResults = this.get('searchResults');
        if (searchResults && searchResults.links) {
            return searchResults.meta.pagination.total;
        } else {
            return;
        }
    }),
    // Total pages of contributor search results
    pages: Ember.computed('searchResults.[]', function() {
        let searchResults = this.get('searchResults');
        if (searchResults && searchResults.links) {
            return searchResults.meta.total;
        } else {
            return;
        }
    }),
    actions: {
        // Adds contributor then redraws view - addition of contributor may change which update/remove contributor requests are permitted
        addContributor(user) {
            this.attrs.addContributor(user.id, 'write', true).then((res) => {
                this.toggleAuthorModification();
                this.get('contributors').pushObject(res);
                this.highlightSuccessOrFailure(res.id, this, 'success');
            }, () => {
                this.get('toast').error('Could not add contributor.');
                this.highlightSuccessOrFailure(user.id, this, 'error');
                user.rollbackAttributes();
            });
        },
        // Adds unregistered contributor, then clears form and switches back to search view.
        // Should wait to transition until request has completed.
        addUnregisteredContributor(fullName, email) {
            let res = this.attrs.addUnregisteredContributor(fullName, email, 'write', true);
            res.then((contributor) => {
                this.get('contributors').pushObject(contributor);
                this.toggleAuthorModification();
                this.set('addState', 'searchView');
                this.set('fullName', '');
                this.set('email', '');
                this.highlightSuccessOrFailure(contributor.id, this, 'success');
            }, () => {
                this.get('toast').error('Could not add unregistered contributor.');
                this.highlightSuccessOrFailure('add-unregistered-contributor-form', this, 'error');
            });

        },
        // Requests a particular page of user results
        findContributors(page) {
            var query = this.get('query');
            if (query) {
                this.attrs.findContributors(query, page).then(() => {
                    this.set('addState', 'searchView');
                }, () => {
                    this.get('toast').error('Could not perform search query.');
                    this.highlightSuccessOrFailure('author-search-box', this, 'error');
                });
            }
        },
        // Removes contributor then redraws contributor list view - removal of contributor may change
        // which additional update/remove requests are permitted.
        removeContributor(contrib) {
            this.attrs.removeContributor(contrib).then(() => {
                this.toggleAuthorModification();
                this.removedSelfAsAdmin(contrib, contrib.get('permission'));
                this.get('contributors').removeObject(contrib);
            }, () => {
                this.get('toast').error('Could not remove author');
                this.highlightSuccessOrFailure(contrib.id, this, 'error');
                contrib.rollbackAttributes();
            });
        },
        // Updates contributor then redraws contributor list view - updating contributor
        // permissions may change which additional update/remove requests are permitted.
        updatePermissions(contributor, permission) {
            let permissionChanges = { [contributor.id]: permission.toLowerCase() };
            this.attrs.editContributors(this.get('contributors'), permissionChanges, {}).then(() => {
                this.toggleAuthorModification();
                this.highlightSuccessOrFailure(contributor.id, this, 'success');
                this.removedSelfAsAdmin(contributor, permission);
            }, () => {
                this.get('toast').error('Could not modify author permissions');
                this.highlightSuccessOrFailure(contributor.id, this, 'error');
                contributor.rollbackAttributes();
            });
        },
        // Updates contributor then redraws contributor list view - updating contributor
        // bibliographic info may change which additional update/remove requests are permitted.
        updateBibliographic(contributor, isBibliographic) {
            let bibliographicChanges = { [contributor.id]: isBibliographic };
            this.attrs.editContributors(this.get('contributors'), {}, bibliographicChanges).then(() => {
                this.toggleAuthorModification();
                this.highlightSuccessOrFailure(contributor.id, this, 'success');
            }, () => {
                this.get('toast').error('Could not modify citation');
                this.highlightSuccessOrFailure(contributor.id, this, 'error');
                contributor.rollbackAttributes();
            });
        },
        // There are 3 view states on left side of Authors panel.  This switches to add unregistered contrib view.
        unregisteredView() {
            this.set('addState', 'unregisteredView');
        },
        // There are 3 view states on left side of Authors panel.  This switches to searching contributor results view.
        searchView() {
            this.set('addState', 'searchView');
            this.set('fullName', '');
            this.set('email', '');
        },
        // There are 3 view states on left side of Authors panel.  This switches to empty view and clears search results.
        resetfindContributorsView() {
            this.set('addState', 'searchView');
        },
        // Reorders contributors in UI then sends server request to reorder contributors. If request fails, reverts
        // contributor list in UI back to original.
        reorderItems(itemModels, draggedContrib) {
            var originalOrder = this.get('contributors');
            this.set('contributors', itemModels);
            var newIndex = itemModels.indexOf(draggedContrib);
            this.attrs.reorderContributors(draggedContrib, newIndex).then(() => {
                this.highlightSuccessOrFailure(draggedContrib.id, this, 'success');
            }, () => {
                this.highlightSuccessOrFailure(draggedContrib.id, this, 'error');
                this.set('contributors', originalOrder);
                this.get('toast').error('Could not reorder contributors');
                draggedContrib.rollbackAttributes();
            });
        }
    },
    // TODO find alternative to jquery selectors. Temporary popover content for authors page.
    didInsertElement: function() {
        this.$('#permissions-popover').popover({
            container: 'body',
            content: '<dl>' +
                '<dt>Read</dt>' +
                    '<dd><ul><li>View preprint</li></ul></dd>' +
                '<dt>Read + Write</dt>' +
                    '<dd><ul><li>Read privileges</li> ' +
                        '<li>Add and configure preprint</li> ' +
                        '<li>Add and edit content</li></ul></dd>' +
                '<dt>Administrator</dt><dd><ul>' +
                    '<li>Read and write privileges</li>' +
                    '<li>Manage authors</li>' +
                    '<li>Public-private settings</li></ul></dd>' +
                '</dl>'
        });
        this.$('#bibliographic-popover').popover({
            container: 'body',
            content: 'Only checked authors will be included in preprint citations. ' +
            'Authors not in the citation can read and modify the preprint as normal.'
        });
        this.$('#author-popover').popover({
            container: 'body',
            content: 'Preprints must have at least one registered administrator and one author showing in the citation at all times.  ' +
            'A registered administrator is a user who has both confirmed their account and has administrator privileges.'
        });
    },
    /**
    * If user removes their own admin permissions, many things on the page must become
    * disabled.  Changing the isAdmin flag to false will remove many of the options
    * on the page.
    */
    removedSelfAsAdmin(contributor, permission) {
        if (this.get('currentUser').id === contributor.get('userId') && permission !== 'ADMIN') {
            this.set('isAdmin', false);
        }
    },
    /**
    * Toggling this property, authorModification, updates several items on the page - disabling elements, enabling
    * others, depending on what requests are permitted
    */
    toggleAuthorModification() {
        this.toggleProperty('authorModification');
    }
});